import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { Archive } from '../dist/archive.js';
import { check, state, writings, dialogueMessages, consolidationMessages } from '../dist/context.js';
import * as old from './helpers/p4-context.mjs';
import { withArchive } from './helpers/archive-fixture.mjs';
import { generate } from '../scripts/p6/generate.mjs';
import { checkArchive } from '../dist/schema.js';

function randomEvents(seed, count) {
  let value = seed >>> 0;
  const rand = () => (value = (Math.imul(value, 1664525) + 1013904223) >>> 0);
  const events = [], pending = [];
  let materialStart = 0;
  const add = (cls, kind, content = '', reply = null, meta = {}, foreign = false) => {
    const seq = events.length + 1;
    const e = { seq,id: 'random-' + seq,branch: foreign ? 'fork:x' : 'dev:v2-dev',scene: foreign ? 'other' : 'web',
      class: cls,kind,actor: kind === 'heard' ? 'owner' : cls === 'control' ? 'system' : 'yuvi',
      t_recorded: 1790000000000 + seq % 53,reply_to: reply,content,model: 'fake',meta };
    events.push(e); return e;
  };
  const contents = ['', '小猫 Ab_%_ 中文', '😀'.repeat(51), 'X'.repeat(16001), 'e\u0301 \0 z', '\0领先', 'said reply_to 原文'];
  for (let i = 0; i < count; i++) {
    const h = add('experience','heard',contents[rand() % contents.length],null,{},i % 37 === 0);
    pending.push(h);
    if (i % 11 === 0) continue; // Queue several heards; keep original seq order.
    const target = pending.shift();
    if (rand() % 4 === 0) add('control','error','',target.id,{ reason:'model_failure', outcome:'not_sent', request_chars:0 });
    else if (rand() % 5 === 0) add('act','silent','理由',target.id);
    else {
      const a = add('act','reply_attempt','',target.id);
      add('act','said',contents[rand() % contents.length],target.id,{attempt:a.id});
    }
    if (i % 7 === 0) {
      const material = events.filter(e => e.scene === 'web' && e.branch === 'dev:v2-dev' && old.isDialogue(e) && e.seq > materialStart);
      const firstUnfinished = events.find(e => e.kind === 'heard' && e.scene === 'web' && e.branch === 'dev:v2-dev' &&
        !events.some(r => r.reply_to === e.id && r.scene === 'web' && r.branch === 'dev:v2-dev' && ['said','silent','error'].includes(r.kind)));
      const batch = material.filter(e => !firstUnfinished || e.seq < firstUnfinished.seq).slice(0, 10);
      if (batch.length) {
        const coverage = { from_seq: batch[0].seq, through_seq: batch.at(-1).seq };
        materialStart = coverage.through_seq;
        if (i % 21 === 0) add('control','unconsolidated','',null,{material:coverage,reason:'backlog'});
        else add('inner','wrote',contents[rand() % contents.length],null,{material:coverage,finish_reason:i % 14 === 0 ? 'length' : 'stop'});
      }
    }
    if (i % 17 === 0) add('inner','wrote','foreign-secret',null,{material:{from_seq:1,through_seq:1000000}},true);
  }
  return events;
}
function compare(archive, events, n, budget) {
  const reference = old.state(events,n), actual = state(archive,n);
  assert.equal(actual.dialogueCount,reference.dialogue.length);
  assert.equal(actual.covered,reference.covered);
  assert.equal(actual.pendingCount,reference.pending.length);
  assert.equal(actual.materialCount,reference.materials.length);
  assert.equal(actual.pressure,reference.pressure);
  assert.deepEqual(archive.dialogue(actual.rawStart),reference.raw);
  assert.deepEqual(archive.materials(n),reference.materials.slice(0,n));
  assert.deepEqual(writings(archive,budget),old.writings(events,budget));
  const heard = events.findLast(e => e.kind === 'heard' && e.scene === 'web' && e.branch === 'dev:v2-dev');
  const config = { persona:'原人设 😀', contextEvents:n, writingChars:budget, ownerName:'小林' };
  const time = Date.now; Date.now = () => 1790000001234;
  try {
    assert.deepEqual(dialogueMessages(archive,heard,config),old.dialogueMessages(events,heard,config));
    const materials = archive.materials(n);
    assert.deepEqual(consolidationMessages(archive,materials,config),old.consolidationMessages(events,materials,config));
  } finally { Date.now = time; }
}

test('F1/F3: randomized P4 differential oracle, bootstrap and append-only progress, with no hot full reads', () => {
  for (let seed = 1; seed <= 36; seed++) withArchive(randomEvents(seed,60 + seed * 3), archive => {
    const readReference = archive.events.bind(archive);
    let events = readReference();
    archive.events = () => { throw Error('full archive read on hot path'); };
    for (const n of [1,2,7,10,20,200]) compare(archive,events,n,[1,100,16000][seed % 3]);
    for (let i = 0; i < 30; i++) {
      const h = archive.append({class:'experience',kind:'heard',actor:'owner',content:'append 😀 %_ Ab\0猫'});events.push(h);
      if (i % 3 !== 0) {
        const a = archive.append({class:'act',kind:'reply_attempt',actor:'yuvi',reply_to:h.id});events.push(a);
        events.push(archive.append({class:'act',kind:'said',actor:'yuvi',reply_to:h.id,content:'接上',meta:{attempt:a.id}}));
      }
      if (i % 5 === 0) {
        const pending = old.state(events,10).materials.slice(0,10);
        if (pending.length) events.push(archive.append({class:'inner',kind:'wrote',actor:'yuvi',content:i % 2 ? '' : '新文字'.repeat(55),model:'fake',
          meta:{ material:{from_seq:pending[0].seq,through_seq:pending.at(-1).seq},finish_reason:'length' }}));
      }
      events = readReference();
      compare(archive,events,10,100);
    }
    for (const args of [{},{query:'Ab'},{query:'ab'},{query:'%_'},{query:'😀'},{query:'\ud83d'},{query:'\ude00'},{query:'\0'},
      {query:'e\u0301'},{query:'absent'}, {from:'2026-01-01',to:'2026-12-31'}, {from:'invalid'}, {query:1}]) {
      assert.deepEqual(check(archive,JSON.stringify(args),'小林'),old.check(events,JSON.stringify(args),'小林'));
    }
  });
});

test('F3/F7: maximum coverage (not latest), whole UTF-16 writing budget, and both scope filters', () => {
  const events = randomEvents(90,10).filter(e => !['wrote','unconsolidated'].includes(e.kind));
  let seq = Math.max(...events.map(e => e.seq)) + 1;
  const add = (content,through,foreign = false) => events.push({seq:seq++,id:'w-' + seq,branch:foreign?'fork:x':'dev:v2-dev',scene:'web',class:'inner',kind:'wrote',actor:'yuvi',t_recorded:1,reply_to:null,content,model:'m',meta:{material:{from_seq:1,through_seq:through}}});
  add('😀'.repeat(30),9);add('a'.repeat(30),5);add('b'.repeat(150),3);add('c'.repeat(20),2);add('foreign-secret',100000,true);
  withArchive(events,archive => {
    const decoded = archive.events();
    assert.equal(state(archive,10).covered,9);
    for (const budget of [1,20,60,100,160,180,1000]) compare(archive,decoded,10,budget);
    assert.equal(check(archive,'{"query":"foreign-secret"}','小林').meta.total,0);
    assert.ok(archive.context(10000).every(e => e.branch === 'dev:v2-dev' && e.scene === 'web'));
  });
});

test('F1/F2: deterministic 20000-event generator, both forms, complete chains and material coverage', async t => {
  const root = await mkdtemp(join(tmpdir(),'yuvi-p6-generator-'));
  t.after(() => rm(root,{recursive:true,force:true}));
  for (const shape of ['typical','empty']) {
    const a = join(root,shape,'archive.sqlite'), b = join(root,shape+'-copy','archive.sqlite');
    const info = generate(a,{count:20000,seed:7,shape}); generate(b,{count:20000,seed:7,shape});
    assert.deepEqual(createHash('sha256').update(await readFile(a)).digest('hex'),createHash('sha256').update(await readFile(b)).digest('hex'));
    assert.equal(info.count,20000);
    const archive = new Archive(join(root,shape));
    try {
      checkArchive(archive.db);
      const events = archive.events(), p = archive.progress();
      assert.equal(p.pendingCount,0); assert.equal(p.materialCount,0); assert.equal(p.firstPending,Infinity);
      for (const kind of ['heard','reply_attempt','said','silent','error','checked','wrote','unconsolidated','restored']) assert.ok(info.counts[kind]>0,kind);
      assert.deepEqual([...new Set(events.filter(e => e.kind==='error').map(e => e.meta.outcome))].sort(),['not_sent','partial','unknown']);
      for (const heard of events.filter(e => e.kind==='heard')) {
        const endings=events.filter(e => e.reply_to===heard.id && ['said','silent','error'].includes(e.kind));assert.equal(endings.length,1);
        const end=endings[0],attempt=events.find(e => e.id===end.meta.attempt);
        if(end.kind==='said'||['partial','unknown'].includes(end.meta.outcome))assert.ok(attempt?.kind==='reply_attempt'&&attempt.reply_to===heard.id&&attempt.seq<end.seq);
        if(end.meta.reason==='model_failure')assert.equal(typeof end.meta.request_chars,'number');
      }
      const dialogue = events.filter(old.isDialogue), materials = events.filter(e => ['wrote','unconsolidated'].includes(e.kind));
      let next=0;
      for (const e of materials) {
        const material=e.meta.material, batch=dialogue.filter(d => d.seq>=material.from_seq && d.seq<=material.through_seq);
        assert.equal(batch[0].seq,dialogue[next].seq); assert.ok(batch.length<=200);
        if(e.kind==='unconsolidated'){
          assert.equal(batch.length,200);assert.ok(dialogue.slice(next).filter(d=>d.seq<e.seq).length>400);
        }
        next+=batch.length;
      }
      assert.equal(next,dialogue.length);
      assert.ok(events.at(-1).t_recorded-events[0].t_recorded>1000*86400000);
      assert.equal(archive.writings(16000).length===0,shape==='empty');
      assert.ok((await readdir(join(root,shape))).every(name=>['archive.sqlite','archive.sqlite-wal','archive.sqlite-shm','service.lock','service.lock-journal'].includes(name)));
    } finally {archive.close();}
  }
});
