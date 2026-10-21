import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleBase, selectDialogue, selectConsolidation, localTime, sha256 } from '../dist/context.js';
import { withArchive } from './helpers/archive-fixture.mjs';
import * as p4 from './helpers/p4-context.mjs';
import { requestParameters, silentTool, checkTool } from '../dist/model.js';

process.env.TZ = 'Asia/Shanghai';
const now = 1792584000000;
const config = { persona: '人设原文\n', ownerName: '小林', writingChars: 16000, contextEvents: 20 };
const events = [
  { seq: 1, id: 'heard-1', class: 'experience', kind: 'heard', actor: 'owner', content: '散步。' },
  { seq: 2, id: 'said-2', class: 'act', kind: 'said', actor: 'yuvi', reply_to: 'heard-1', content: '一起走。' },
  { seq: 3, class: 'inner', kind: 'wrote', content: '我留下的原文 😀', meta: { material: { from_seq: 1, through_seq: 2 } } },
  { seq: 4, id: 'heard-4', class: 'experience', kind: 'heard', actor: 'owner', content: '再走一段。' }
];
test('P7 pure base assembly: selection, exact P4 messages, sections, parameters and digest agree', () => {
  withArchive(events, archive => {
    const rows = archive.events(), heard = rows.at(-1), savedClock = Date.now;
    Date.now = () => now;
    const expectedDialogue = p4.dialogueMessages(rows, heard, config);
    const material = rows.slice(0, 2), expectedConsolidation = p4.consolidationMessages(rows, material, config);
    Date.now = () => { throw Error('Presentation must use the explicit clock'); };
    try {
      const dialogue = assembleBase({ purpose: 'dialogue', selected: selectDialogue(archive, config), heard }, config, now, 'Asia/Shanghai');
      const consolidation = assembleBase({ purpose: 'consolidation', selected: selectConsolidation(archive, material, config), maxTokens: 4000 }, config, now, 'Asia/Shanghai');
      assert.deepEqual(dialogue.messages, expectedDialogue);
      assert.deepEqual(consolidation.messages, expectedConsolidation);
      for (const assembled of [dialogue, consolidation]) {
        assert.deepEqual(assembled.manifest.total, { messages: assembled.messages.length,
          chars: assembled.messages.reduce((n, m) => n + m.content.length, 0) });
        assert.equal(assembled.manifest.sections.reduce((n, s) => n + s.messages, 0), assembled.manifest.total.messages);
        assert.equal(assembled.manifest.sections.reduce((n, s) => n + s.chars, 0), assembled.manifest.total.chars);
        assert.equal(assembled.manifest.messages_sha256, sha256(JSON.stringify(assembled.messages)));
      }
      assert.ok(Buffer.byteLength(JSON.stringify(dialogue.manifest)) <= 1500);
      assert.deepEqual(dialogue.parameters, { tools: [silentTool, checkTool], tool_choice: 'auto' });
      assert.deepEqual(consolidation.parameters, { max_tokens: 4000 });
      assert.deepEqual(requestParameters({ lastStep: true }), { tools: [silentTool], tool_choice: 'auto' });
    } finally { Date.now = savedClock; }
  });
});
test('P7 explicit IANA timezone presentation matches native P6 clock across DST transitions', () => {
  const saved = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Asia/Shanghai', 'America/New_York', 'Australia/Lord_Howe', 'Asia/Kathmandu']) {
      process.env.TZ = zone;
      for (const stamp of ['2026-03-08T06:59:59.001Z', '2026-03-08T07:00:00.999Z', '2026-11-01T06:00:00Z', '1970-01-01T00:00:00Z']) {
        const ms = Date.parse(stamp); assert.equal(localTime(ms, zone), p4.localTime(ms));
      }
    }
  } finally { process.env.TZ = saved; }
});

test('P7 difference normalization maps every declared reference without masking raw content', async () => {
  const { normaliseP7Events, withoutRecordedTime } = await import('./helpers/p7-equivalence.mjs');
  const old = [
    { seq: 1, id: 'old-h', class: 'experience', kind: 'heard', reply_to: null, content: 'new-h', t_recorded: 1, meta: {} },
    { seq: 2, id: 'old-a', class: 'act', kind: 'reply_attempt', reply_to: 'old-h', content: '', t_recorded: 1, meta: {} },
    { seq: 3, id: 'old-s', class: 'act', kind: 'said', reply_to: 'old-h', content: '', t_recorded: 1, meta: { attempt: 'old-a' } },
    { seq: 4, id: 'old-w', class: 'inner', kind: 'wrote', reply_to: null, content: '', t_recorded: 1, meta: { material: { from_seq: 1, through_seq: 3 } } },
    { seq: 5, id: 'old-c', class: 'act', kind: 'checked', reply_to: 'old-h', content: '', t_recorded: 1, meta: { result_seqs: [1, 3, 4], total: 4 } },
    { seq: 6, id: 'old-r', class: 'control', kind: 'restored', reply_to: null, content: '', t_recorded: 1, meta: { through_seq: 5, through_id: 'old-c', snapshot_sha256: 'same' } }
  ];
  const actual = structuredClone(old);
  for (const event of actual) {
    event.seq += 1; event.id = event.id.replace('old-', 'new-'); event.t_recorded++;
    if (event.reply_to) event.reply_to = 'new-h';
  }
  actual[2].meta.attempt = 'new-a'; actual[3].meta.material = { from_seq: 2, through_seq: 4 };
  actual[4].meta.result_seqs = [2, 4, 5]; actual[5].meta.through_seq = 6; actual[5].meta.through_id = 'new-c';
  actual.unshift({ seq: 1, id: 'presentation', class: 'control', kind: 'presented' });
  const mapped = normaliseP7Events(old, actual);
  assert.deepEqual(mapped.events, withoutRecordedTime(old));
  assert.deepEqual(mapped.frames([[{ event: 'heard', data: 'new-h' }, { event: 'delta', data: '{"text":"new-h"}' }]]),
    [[{ event: 'heard', data: 'old-h' }, { event: 'delta', data: '{"text":"new-h"}' }]]);
  actual[5].meta.total = 5; // A behavioral change must survive normalization.
  assert.notDeepEqual(normaliseP7Events(old, actual).events, withoutRecordedTime(old));
});
