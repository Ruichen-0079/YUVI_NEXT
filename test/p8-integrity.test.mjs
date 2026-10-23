import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync,writeFileSync,truncateSync,statSync,chmodSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { Archive } from '../dist/archive.js';
import { ArchiveIndex,buildIndex,verifyIndex } from '../dist/archive-index.js';
import { createSnapshot,restoreSnapshot,verifySnapshot } from '../dist/snapshots.js';
const rows=db=>db.prepare('SELECT *,hex(CAST(content AS BLOB)) content_bytes FROM events ORDER BY seq').all();
// POSIX fcntl locks are process-wide: closing a raw fd in the lock owner
// would release its locks. Inspect coordination bytes from another process.
const coordination=path=>spawnSync(process.execPath,['--input-type=module','-e',"import{readFileSync}from'node:fs';process.stdout.write(readFileSync(process.argv[1]));",path]).stdout;
const command=(dir,args)=>spawnSync(process.execPath,['dist/maintenance.js','index',...args],{env:{...process.env,YUVI_DATA_DIR:dir},encoding:'utf8'});
const seed=dir=>{const a=new Archive(dir);for(let i=0;i<30;i++){const h=a.append({class:'experience',kind:'heard',actor:'owner',content:'旧经历喀纳斯'+i});a.append({class:'act',kind:'silent',actor:'yuvi',reply_to:h.id,content:i%2?'':'等忙完'});}return a;};

test('P8 C6/K1-K7/K12: derived schema, private permissions, corrupt/version/identity/count repair, snapshot restore',async()=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p8-integrity-'));
 try{
  for(const fault of ['missing','truncate','page','version','through','count','identity']){
   const dir=join(root,fault),a=seed(dir),file=join(dir,'index.sqlite');let index;
   try{
    buildIndex(dir);const before=rows(a.db),schema=a.db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
    if(fault==='missing')rmSync(file);
    else if(fault==='truncate')truncateSync(file,Math.floor(statSync(file).size/2));
    else if(fault==='page'){const bytes=readFileSync(file);bytes.fill(0xff,4096,8192);writeFileSync(file,bytes);}
    else {const db=new DatabaseSync(file);try{
     if(fault==='version')db.prepare('UPDATE metadata SET value=? WHERE key=?').run(JSON.stringify('unknown'),'tokenizer');
     if(fault==='through')db.prepare('UPDATE metadata SET value=? WHERE key=?').run(JSON.stringify('wrong'),'through_id');
     if(fault==='count'){db.exec('DELETE FROM docs WHERE seq<=10; DELETE FROM terms WHERE rowid<=10;');}
     if(fault==='identity')db.prepare('UPDATE metadata SET value=? WHERE key=?').run(JSON.stringify('another-archive'),'archive_first_id');
    }finally{db.close();}}
    const status=verifyIndex(a.db,file,true).status;assert.equal(status,fault==='missing'?'missing':fault==='version'?'version':['through','count','identity'].includes(fault)?'mismatch':'corrupt',fault);
    index=new ArchiveIndex(a.db,dir);await index.ready();assert.equal(verifyIndex(a.db,file,true).status,'ok',fault);
    assert.equal(index.search('喀纳斯',-Infinity,Infinity).total,30);
    assert.deepEqual(rows(a.db),before);assert.deepEqual(a.db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),schema);assert.equal(a.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.equal(statSync(file).mode&0o777,0o600);
   }finally{await index?.close();a.close();}
  }
  const dir=join(root,'privacy'),a=seed(dir);let index;
  try{
   const sentences=Array.from({length:10},(_,i)=>`测试原文第${i}条：蓝鲸-7Q 在 23:15 说“不要遗忘”。这里是独立的 Bluewhale 日常材料 ${i}，保留空格、标点和完整句子。`);
   for(const content of sentences)a.append({class:'experience',kind:'heard',actor:'owner',content});
   buildIndex(dir);index=new ArchiveIndex(a.db,dir);
   index.search('Bluewhale',-Infinity,Infinity);
   const db=new DatabaseSync(index.file,{readOnly:true});try{
    const objects=db.prepare('SELECT name,sql FROM sqlite_master').all();assert.ok(!objects.some(o=>o.name.endsWith('_content')));assert.match(objects.find(o=>o.name==='terms').sql,/content=''/);
    for(const table of ['docs','metadata'])for(const row of db.prepare('SELECT * FROM '+table).iterate())for(const value of Object.values(row))if(typeof value==='string'||value instanceof Uint8Array)assert.ok(Buffer.byteLength(value)<=256);
   }finally{db.close();}
   for(const name of ['index.sqlite','index.sqlite-wal','index.sqlite-shm'])if(existsSync(join(dir,name))){assert.equal(statSync(join(dir,name)).mode&0o777,0o600);const bytes=readFileSync(join(dir,name));for(const s of sentences)for(const encoding of ['utf8','utf16le'])assert.equal(bytes.includes(Buffer.from(s,encoding)),false);}
   const snap=createSnapshot({dataDir:dir,snapshotDir:join(root,'snapshots')});verifySnapshot(snap);const target=join(root,'restored');restoreSnapshot(snap,target);assert.equal(existsSync(join(target,'index.sqlite')),false);
   const restored=new Archive(target),rebuilt=new ArchiveIndex(restored.db,target);
   try{await rebuilt.ready();assert.equal(rebuilt.search('Bluewhale',-Infinity,Infinity).total,10);}finally{await rebuilt.close();restored.close();}
  }finally{await index?.close();a.close();}
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('P8 K10/K13/K14: unavailable index does not write archive; maintenance refuses live writer and is logically readonly',async()=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p8-maintenance-'));let a=seed(root),index;
 try{
  buildIndex(root);index=new ArchiveIndex(a.db,root);const file=index.file;
  const before=rows(a.db),archive=readFileSync(join(root,'archive.sqlite')),lock=coordination(join(root,'service.lock')),lockMtime=statSync(join(root,'service.lock')).mtimeMs,indexBytes=readFileSync(file);
  assert.notEqual(command(root,['rebuild']).status,0);assert.deepEqual(readFileSync(file),indexBytes);
  assert.equal(JSON.parse(command(root,['verify','--full']).stdout).status,'ok');
  assert.deepEqual(rows(a.db),before);assert.deepEqual(readFileSync(join(root,'archive.sqlite')),archive);assert.deepEqual(coordination(join(root,'service.lock')),lock);assert.equal(statSync(join(root,'service.lock')).mtimeMs,lockMtime);
  chmodSync(file,0o400);const result=index.search('喀纳斯',-Infinity,Infinity);assert.equal(result.fallback,'index_unavailable');assert.deepEqual(rows(a.db),before);
  await index.close();index=undefined;a.close();a=undefined;
  const cold=readFileSync(join(root,'archive.sqlite'));assert.equal(JSON.parse(command(root,['verify']).stdout).status,'ok');assert.deepEqual(readFileSync(join(root,'archive.sqlite')),cold);
  chmodSync(file,0o600);const rebuilt=command(root,['rebuild']);assert.equal(rebuilt.status,0,rebuilt.stderr);assert.equal(JSON.parse(rebuilt.stdout).status,'ok');assert.equal(statSync(file).mode&0o777,0o600);assert.deepEqual(readFileSync(join(root,'archive.sqlite')),cold);
 }finally{await index?.close();a?.close();rmSync(root,{recursive:true,force:true});}
});
