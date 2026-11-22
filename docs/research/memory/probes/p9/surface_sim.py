"""P9 planning probe: simulate cue surfacing on P8 life archives (A0-excerpt) with as-of-time FTS, several cue caps."""
import sys, json, sqlite3, datetime
sys.path.insert(0, sys.argv[3] if len(sys.argv) > 3 else '.'); from my_measure import tokens, at  # independent tokenizer from the P8 acceptance tools
run, life_file = sys.argv[1], sys.argv[2]; caps = [50000, 5000, 1000, 300]
life = json.load(open(life_file))
c = sqlite3.connect(f'file:{run}/data/archive.sqlite?mode=ro', uri=True)
ev = c.execute("select seq,class,kind,t_recorded,content,meta from events order by seq").fetchall()
# probe asks and carriers
anchors = {}
for f in life['facts']:
    for v in f['versions']: anchors[f['id'] + v.get('version', '')] = v['anchor']
for p in life['people']:
    for i, m in enumerate(p['mentions']): anchors[p['id'] + ('abcd'[i] if len(p['mentions']) > 1 else '')] = m['anchor']
probes = {(at(life, p['day'], p['time']), p['ask']): p for p in life['probes']}
m = sqlite3.connect(':memory:'); m.execute("create virtual table t using fts5(x, content='', contentless_delete=1, tokenize='ascii')"); m.execute("create virtual table v using fts5vocab(t,'row')")
m.execute('create table d(seq integer primary key, kind text, chars integer)')
writings = []  # (seq, chars, content, material_through)
stats = {cap: dict(turns=0, fired=0, items=0, chars=0, probe_turns=0, probe_target_hit=0, probe_targets=0, probe_distractor_chars=0, by_seq={}) for cap in caps}
budget = life['config']['YUVI_CONTEXT_WRITING_CHARS']
for seq, cls, kind, t, content, meta in ev:
    if cls == 'experience' and kind == 'heard':
        # foreground: newest writings within budget (P4 rule), always at least one
        fg = set(); s = 0
        for w in reversed(writings):
            if fg and s + w[1] > budget: break
            fg.add(w[0]); s += w[1]
        qt = tokens(content, True)[:32]
        df = sorted([(m.execute('select doc from v where term=?', (x,)).fetchone() or [0])[0], i, x] for i, x in enumerate(qt))
        p = probes.get((t, content))
        for cap in caps:
            st = stats[cap]; st['turns'] += 1
            used, ssum = [], 0
            for n, i, x in df:
                if not used or ssum + n <= cap: used.append((n, x)); ssum += n
            picked = []
            if used and used[0][0] <= cap and used[0][0] > 0:
                q = ' OR '.join('"' + x + '"' for _, x in used)
                rows = m.execute("select t.rowid, d.chars from t join d on d.seq=t.rowid where t match ? and d.kind='wrote' order by rank, t.rowid desc limit 20", (q,)).fetchall()
                chars = 0
                for r, ch in rows:
                    if r in fg: continue
                    if len(picked) == 3: break
                    if chars + ch > 2000: continue
                    picked.append(r); chars += ch
            if picked: st['fired'] += 1; st['items'] += len(picked); st['chars'] += sum(dict((w[0], w[1]) for w in writings)[x] for x in picked)
            for x in picked: st['by_seq'][x] = st['by_seq'].get(x, 0) + 1
            if p:
                st['probe_turns'] += 1
                wmap = {w[0]: w[2] for w in writings}
                carriers = {x for x in picked for tid in p['targets'] if anchors.get(tid) and anchors[tid] in wmap[x]}
                st['probe_targets'] += len(p['targets'])
                st['probe_target_hit'] += sum(1 for tid in p['targets'] if any(anchors.get(tid) and anchors[tid] in wmap[x] for x in picked))
                st['probe_distractor_chars'] += sum(len(wmap[x]) for x in picked if x not in carriers)
    if (cls, kind) in [('experience', 'heard'), ('act', 'said'), ('act', 'silent')] or (cls == 'inner' and kind == 'wrote' and content):
        tk = tokens(content); m.execute('insert into t(rowid,x) values(?,?)', (seq, ' '.join(tk))); m.execute('insert into d values(?,?,?)', (seq, kind, len(content)))
        if cls == 'inner': writings.append((seq, len(content), content, json.loads(meta).get('material', {}).get('through_seq')))
out = {}
for cap, st in stats.items():
    top = sorted(st['by_seq'].values(), reverse=True)
    out[cap] = dict(turns=st['turns'], fired_rate=round(st['fired'] / st['turns'], 3), mean_chars_when_fired=round(st['chars'] / max(1, st['fired'])),
                    probe_target_hit=f"{st['probe_target_hit']}/{st['probe_targets']}", probe_distractor_chars=st['probe_distractor_chars'],
                    distinct_writings_surfaced=len(st['by_seq']), top5_share=round(sum(top[:5]) / max(1, sum(top)), 3))
print(json.dumps(out))
