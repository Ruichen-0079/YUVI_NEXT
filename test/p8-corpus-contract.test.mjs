import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync,existsSync,statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Archive } from '../dist/archive.js';
import { ArchiveIndex,buildIndex } from '../dist/archive-index.js';
import { varied } from '../scripts/p8/corpus.mjs';
test('P8 C6: 50000-event index stores postings only; 10 long originals and1000 sampled bodies are absent',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yuvi-p8-no-copy-'));let a,index;
 try{
  const corpus=varied(join(dir,'archive.sqlite'));a=new Archive(dir);buildIndex(dir);index=new ArchiveIndex(a.db,dir);
  for(const q of corpus.queries)if(q.id!=='R17')index.search(q.query,q.from??-Infinity,q.to??Infinity,q.kinds);
  const db=new DatabaseSync(index.file,{readOnly:true});try{
   const schema=db.prepare('SELECT name,sql FROM sqlite_master').all();assert.ok(!schema.some(r=>r.name.endsWith('_content')));assert.match(schema.find(r=>r.name==='terms').sql,/content=''/);
   const allowed=new Set(['metadata','sqlite_autoindex_metadata_1','docs','docs_time','terms','terms_data','terms_idx','terms_docsize','terms_config','vocab']);assert.ok(schema.every(r=>allowed.has(r.name)));
   for(const table of ['metadata','docs'])for(const row of db.prepare('SELECT * FROM '+table).iterate())for(const v of Object.values(row))if(typeof v==='string'||v instanceof Uint8Array)assert.ok(Buffer.byteLength(v)<=256);
  }finally{db.close();}
  const files=['index.sqlite','index.sqlite-wal','index.sqlite-shm'].filter(n=>existsSync(join(dir,n)));
  for(const file of files)assert.equal(statSync(join(dir,file)).mode&0o777,0o600);
  const bytes=Buffer.concat(files.filter(n=>n!=='index.sqlite-shm').map(n=>readFileSync(join(dir,n))));
  assert.equal(corpus.privacy.length,10);for(const text of corpus.privacy){assert.ok([...text].length>=40);for(const encoding of ['utf8','utf16le'])assert.equal(bytes.includes(Buffer.from(text,encoding)),false);}
  let sampled=0;
  for(const row of a.db.prepare("SELECT content FROM events WHERE kind IN ('heard','said','silent','wrote') ORDER BY seq").iterate()){
   if(row.content.length<16||!/[\s\p{P}]/u.test(row.content))continue;
   for(const encoding of ['utf8','utf16le'])assert.equal(bytes.includes(Buffer.from(row.content,encoding)),false);if(++sampled===1000)break;
  }assert.equal(sampled,1000);
 }finally{await index?.close();a?.close();rmSync(dir,{recursive:true,force:true});}
});
