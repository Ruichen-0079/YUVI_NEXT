// Read-only diagnostics. These readers never acquire the service lock and are
// never consulted by runtime selection, scheduling or model behavior.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CURRENT_SCOPE, type Event } from './archive.js';
import { assembleBase, renderStep, record, messageSize, sha256, type Section, type PresentationManifest } from './context.js';
import type { Message } from './model.js';

type Scope = { scene: string; branch: string };
type Outcome = { status: 'completed' | 'failed' | 'unknown' | 'incomplete'; reason?: unknown; outcome?: unknown; http_status?: unknown };
type Pending = { seq: number; id: string; reply_to: string | null; purpose: string; step?: number; time: number;
  writing?: Section; material?: Section; bytes: number };
const decode = (row: Record<string, unknown>) => ({ ...row, meta: JSON.parse(row.meta as string) }) as Event;
const dialogue = "((class='experience' AND kind='heard') OR (class='act' AND kind IN ('said','silent')))";
const sameRange = (a?: Section, b?: { from_seq?: number; through_seq?: number }) =>
  a && b && a.first_seq === b.from_seq && a.last_seq === b.through_seq;

// One chronological scan resolves outcomes without an N+1 scan per request.
// Only unfinished requests are retained, never a second copy of the archive.
function visit(db: DatabaseSync, scope: Scope, finished: (p: Pending, outcome: Outcome) => void) {
  const pending = new Map<string, Pending>();
  const turns = new Map<string, Set<string>>();
  let consolidation: Pending | undefined;
  const end = (p: Pending, outcome: Outcome) => {
    pending.delete(p.id);
    if (p.reply_to) { const set = turns.get(p.reply_to); set?.delete(p.id); if (!set?.size) turns.delete(p.reply_to); }
    finished(p, outcome);
  };
  for (const row of db.prepare(`SELECT seq,id,reply_to,class,kind,t_recorded,meta,length(CAST(meta AS BLOB)) AS bytes
    FROM events NOT INDEXED WHERE scene=? AND branch=? AND
    ((class='control' AND kind IN ('presented','error')) OR (class='act' AND kind IN ('said','silent')) OR (class='inner' AND kind='wrote'))
    ORDER BY seq`).iterate(scope.scene, scope.branch)) {
    if (row.kind === 'presented') {
      const meta = JSON.parse(row.meta as string);
      const sections: Section[] = Array.isArray(meta.sections) ? meta.sections : [];
      const p: Pending = { seq: Number(row.seq), id: row.id as string, reply_to: row.reply_to as string | null,
        purpose: meta.purpose, step: meta.step, time: Number(row.t_recorded), bytes: Number(row.bytes),
        writing: sections.find((s: Section) => s.name === 'writings'), material: sections.find((s: Section) => s.name === 'material') };
      if (p.purpose === 'consolidation') {
        if (consolidation) finished(consolidation, { status: 'incomplete' });
        consolidation = p;
      } else {
        const previous = pending.get(meta.previous);
        if (previous && previous.reply_to === p.reply_to && previous.step! + 1 === p.step) end(previous, { status: 'completed' });
        pending.set(p.id, p);
        if (p.reply_to) { const set = turns.get(p.reply_to) ?? new Set(); set.add(p.id); turns.set(p.reply_to, set); }
      }
    } else if (row.kind === 'wrote') {
      if (consolidation && sameRange(consolidation.material, JSON.parse(row.meta as string).material)) {
        finished(consolidation, { status: 'completed' }); consolidation = undefined;
      }
    } else {
      const meta = row.kind === 'error' ? JSON.parse(row.meta as string) : {};
      const outcome: Outcome = row.kind === 'error' ? { status: 'failed',
        ...Object.fromEntries(['reason', 'outcome', 'http_status'].filter(k => Object.hasOwn(meta, k)).map(k => [k, meta[k]])) } : { status: 'completed' };
      for (const id of [...(turns.get(row.reply_to as string) ?? [])]) end(pending.get(id)!, outcome);
    }
  }
  for (const p of pending.values()) finished(p, { status: 'unknown' });
  if (consolidation) finished(consolidation, { status: 'incomplete' });
}
export function presentedSummary(db: DatabaseSync, scope: Scope = CURRENT_SCOPE) {
  let count = 0, bytes = 0, maximum = 0, firstSeq = Infinity, lastSeq = 0, first: number | null = null, last: number | null = null;
  const byPurpose: Record<string, number> = {}, byStep: Record<string, number> = {}, byStatus: Record<string, number> = {};
  const groups: Record<string, number> = {};
  visit(db, scope, (p, outcome) => {
    count++; bytes += p.bytes; maximum = Math.max(maximum, p.bytes);
    if (p.seq < firstSeq) { firstSeq = p.seq; first = p.time; } if (p.seq > lastSeq) { lastSeq = p.seq; last = p.time; }
    byPurpose[p.purpose] = (byPurpose[p.purpose] ?? 0) + 1;
    const step = p.step === undefined ? 'consolidation' : String(p.step);
    byStep[step] = (byStep[step] ?? 0) + 1; byStatus[outcome.status] = (byStatus[outcome.status] ?? 0) + 1;
    const group = `${p.purpose}/${step}/${outcome.status}`; groups[group] = (groups[group] ?? 0) + 1;
  });
  return { evidence: 'assembled before attempted request; no claim of receipt, attention or use', count, by_purpose: byPurpose,
    by_step: byStep, by_status: byStatus, groups, first_time: first, last_time: last,
    meta_bytes: { total: bytes, average: count ? bytes / count : 0, maximum } };
}
export function presentedWritings(db: DatabaseSync, scope: Scope = CURRENT_SCOPE) {
  const truncates = (db.prepare("SELECT CAST(x'610062' AS TEXT) AS value").get()!.value as string).length === 1;
  const writings = db.prepare(`SELECT seq,t_recorded FROM events NOT INDEXED WHERE scene=? AND branch=? AND class='inner' AND kind='wrote'
    AND ${truncates ? 'length(content)>0' : "content<>''"} ORDER BY seq`).all(scope.scene, scope.branch).map(r => ({
      seq: Number(r.seq), t_recorded: Number(r.t_recorded), dialogue: 0, consolidation: 0,
      dialogue_completed: 0, consolidation_completed: 0, first_presented: null as number | null, last_presented: null as number | null }));
  const firstSeq = new Float64Array(writings.length).fill(Infinity), lastSeq = new Float64Array(writings.length);
  const changes = Array.from({ length: 4 }, () => new Float64Array(writings.length + 1));
  const position = (seq: number, inclusive: boolean) => {
    let lo = 0, hi = writings.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (writings[mid].seq < seq || (inclusive && writings[mid].seq === seq)) lo = mid + 1; else hi = mid; }
    return lo;
  };
  visit(db, scope, (p, outcome) => {
    if (!p.writing) return;
    const lo = position(p.writing.first_seq!, false), hi = position(p.writing.last_seq!, true), kind = p.purpose === 'dialogue' ? 0 : 1;
    changes[kind][lo]++; changes[kind][hi]--;
    if (outcome.status === 'completed') { changes[kind + 2][lo]++; changes[kind + 2][hi]--; }
    for (let i = lo; i < hi; i++) {
      const w = writings[i];
      if (p.seq < firstSeq[i]) { firstSeq[i] = p.seq; w.first_presented = p.time; }
      if (p.seq > lastSeq[i]) { lastSeq[i] = p.seq; w.last_presented = p.time; }
    }
  });
  const running = [0, 0, 0, 0], fields = ['dialogue', 'consolidation', 'dialogue_completed', 'consolidation_completed'] as const;
  for (let i = 0; i < writings.length; i++) fields.forEach((field, j) => { running[j] += changes[j][i]; writings[i][field] = running[j]; });
  return { unit: 'requests; dialogue steps 0–3 each count once; only recorded presentations count', writings,
    never_presented: writings.filter(w => w.dialogue + w.consolidation === 0).length };
}

export function presentedShow(db: DatabaseSync, seq: number, persona: string | undefined, includeMessages = false) {
  const row = db.prepare("SELECT * FROM events WHERE seq=? AND class='control' AND kind='presented'").get(seq);
  if (!row) throw new Error('Presented record not found.');
  const event = decode(row), meta = event.meta as unknown as PresentationManifest, scope = { scene: event.scene, branch: event.branch };
  let outcome: Outcome = { status: meta.purpose === 'consolidation' ? 'incomplete' : 'unknown' };
  visit(db, scope, (p, value) => { if (p.seq === seq) outcome = value; });
  const result: Record<string, unknown> = { seq, manifest: meta, outcome,
    reconstruction: { status: 'rules_unsupported', scope: 'messages only; tool definitions are current rule constants, not saved historical HTTP bytes' } };
  if (meta.format !== 1 || meta.rules !== 'p7') return result;
  let status = meta.node_major !== Number(process.versions.node.split('.')[0]) ? 'node_mismatch' :
    persona === undefined || sha256(persona) !== meta.persona?.sha256 ? 'persona_mismatch' : 'exact';
  try {
    let base = event, m = meta;
    for (let depth = 0; (m.step ?? 0) > 0; depth++) {
      if (depth >= 3) throw Error();
      const prior = db.prepare("SELECT * FROM events WHERE id=? AND seq<? AND class='control' AND kind='presented'").get(m.previous!, base.seq);
      if (!prior) throw Error(); const previous = decode(prior), pm = previous.meta as unknown as PresentationManifest;
      if (pm.rules !== 'p7' || pm.format !== 1 || pm.step !== m.step! - 1 || previous.reply_to !== event.reply_to) throw Error();
      base = previous; m = pm;
    }
    const source = (name: string) => {
      const section = m.sections.find((s: Section) => s.name === name); if (!section) return [];
      const filter = name === 'writings' ? "class='inner' AND kind='wrote'" : dialogue;
      const events = db.prepare(`SELECT * FROM events WHERE seq>=? AND seq<=? AND seq<? AND scene=? AND branch=? AND ${filter} ORDER BY seq`)
        .all(section.first_seq!, section.last_seq!, base.seq, scope.scene, scope.branch).map(decode).filter(e => name !== 'writings' || e.content !== '');
      if (events.length !== section.count) throw Error(); return events;
    };
    const config = { persona: persona !== undefined && sha256(persona) === m.persona.sha256 ? persona : '', ownerName: m.owner_name, writingChars: m.writing_chars };
    let assembled;
    if (m.purpose === 'dialogue') {
      const heard = db.prepare("SELECT *,CAST(content AS BLOB) AS original_content FROM events WHERE id=? AND seq<? AND scene=? AND branch=? AND class='experience' AND kind='heard'")
        .get(base.reply_to!, base.seq, scope.scene, scope.branch);
      if (!heard) throw Error();
      assembled = assembleBase({ purpose: 'dialogue', selected: { writings: source('writings'), window: source('window') }, heard: { ...decode(heard), content: Buffer.from(heard.original_content as Uint8Array).toString('utf8') } },
        config, m.now, m.time_zone, m.node_major);
    } else assembled = assembleBase({ purpose: 'consolidation', selected: { writings: source('writings'), material: source('material') }, maxTokens: m.request.max_tokens! },
      config, m.now, m.time_zone, m.node_major);
    const messages: Message[] = assembled.messages;
    for (const section of meta.sections as Section[]) {
      if (section.name !== 'step') continue;
      const replies = section.results!.map(reference => {
        if ('ignored' in reference) return '本步继续查阅；这个调用没有作为回合结局。';
        const checkedRow = db.prepare("SELECT * FROM events WHERE id=? AND seq<? AND scene=? AND branch=? AND class='act' AND kind='checked'")
          .get(reference.checked, seq, scope.scene, scope.branch);
        if (!checkedRow) throw Error(); const checked = decode(checkedRow), cm = checked.meta as { invalid?: boolean; result_seqs: number[]; total: number };
        if (cm.invalid) return '查阅参数无效；请使用子串及有效的日期范围。';
        const records = (cm.result_seqs as number[]).map(n => {
          const found = db.prepare('SELECT * FROM events WHERE seq=? AND seq<? AND scene=? AND branch=?').get(n, checked.seq, scope.scene, scope.branch);
          if (!found) throw Error(); return decode(found);
        });
        return `共匹配${cm.total}条，返回${records.length}条。\n\n${records.map(e => record(e, m.owner_name, true, m.time_zone)).join('\n\n')}`;
      });
      messages.push(...renderStep(section.assistant_text!, section.tool_calls!, replies));
    }
    const digest = sha256(JSON.stringify(messages));
    let offset = 0;
    const sectionsMatch = (meta.sections as Section[]).every(section => {
      const size = messageSize(messages.slice(offset, offset + section.messages)); offset += section.messages;
      return size.messages === section.messages && size.chars === section.chars;
    });
    if (status === 'exact' && (digest !== meta.messages_sha256 || !sectionsMatch || offset !== messages.length ||
      JSON.stringify(messageSize(messages)) !== JSON.stringify(meta.total))) status = 'mismatch';
    result.reconstruction = { status, messages_sha256: digest, scope: 'messages only; other HTTP fields are not a historical byte-for-byte reconstruction' };
    if (includeMessages) result.messages = messages;
  } catch {
    result.reconstruction = { status: status === 'exact' ? 'mismatch' : status, reason: 'Cannot reproduce sources, chain or time-zone presentation.' };
  }
  return result;
}
export function presentedCommand(args: string[]) {
  const [command, rawSeq, flag] = args;
  if (!((command === 'summary' || command === 'writings') && args.length === 1) &&
    !(command === 'show' && /^\d+$/.test(rawSeq ?? '') && Number.isSafeInteger(Number(rawSeq)) && args.length >= 2 && args.length <= 3 && (flag === undefined || flag === '--messages')))
    throw new Error('Invalid maintenance command or arguments.');
  const directory = process.env.YUVI_DATA_DIR;
  if (!directory?.trim()) throw new Error('Missing required configuration: YUVI_DATA_DIR');
  const db = new DatabaseSync(join(directory, 'archive.sqlite'), { readOnly: true });
  try {
    db.exec('BEGIN'); // One coherent WAL read snapshot, not the service lock.
    if (command === 'summary') return presentedSummary(db);
    if (command === 'writings') return presentedWritings(db);
    let persona: string | undefined;
    if (process.env.YUVI_PERSONA_FILE) try { persona = readFileSync(process.env.YUVI_PERSONA_FILE, 'utf8'); } catch { /* report mismatch */ }
    return presentedShow(db, Number(rawSeq), persona, flag === '--messages');
  } finally { db.close(); }
}
