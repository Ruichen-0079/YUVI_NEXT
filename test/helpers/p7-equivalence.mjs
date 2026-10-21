// P7 adds real archive rows. Normalize only declared ID/seq references, never
// arbitrary content or numbers: masking those would conceal behavioral changes.
export function normaliseP7Events(baseline, actual) {
  const events = actual.filter(e => !(e.class === 'control' && e.kind === 'presented'));
  if (events.length !== baseline.length) throw Error('Non-presentation event count differs');
  const ids = new Map(events.map((e, i) => [e.id, baseline[i].id]));
  const seqs = new Map(events.map((e, i) => [e.seq, baseline[i].seq]));
  const id = value => value == null ? value : ids.get(value) ?? value;
  const seq = value => value == null ? value : seqs.get(value) ?? value;
  const normalized = events.map(event => {
    const { t_recorded, ...e } = structuredClone(event);
    e.id = id(e.id); e.seq = seq(e.seq); e.reply_to = id(e.reply_to);
    if (Object.hasOwn(e.meta, 'attempt')) e.meta.attempt = id(e.meta.attempt);
    if (e.meta.material) {
      e.meta.material.from_seq = seq(e.meta.material.from_seq);
      e.meta.material.through_seq = seq(e.meta.material.through_seq);
    }
    if (Array.isArray(e.meta.result_seqs)) e.meta.result_seqs = e.meta.result_seqs.map(seq);
    if (e.class === 'control' && e.kind === 'restored') {
      e.meta.through_seq = seq(e.meta.through_seq); e.meta.through_id = id(e.meta.through_id);
    }
    return e;
  });
  return { events: normalized, frames: groups => groups.map(group => group.map(({ event, data }) => ({
    event, data: ['heard', 'done', 'silent'].includes(event) ? id(data) : data
  }))) };
}
export const withoutRecordedTime = events => events.map(({ t_recorded, ...event }) => event);
