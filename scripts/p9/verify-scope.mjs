// Whole derived-row scope witness, read-only source; no service lock or rebuild.
import {DatabaseSync} from 'node:sqlite';import {existsSync} from 'node:fs';import {resolve,join} from 'node:path';import {CURRENT_SCOPE} from '../../dist/archive.js';
export function verifyScope(directory){const source=join(directory,'archive.sqlite'),index=join(directory,'index.sqlite');if(!existsSync(source)||!existsSync(index))throw Error('Synthetic scope fixture missing');const db=new DatabaseSync(source,{readOnly:true});try{
 db.prepare('ATTACH DATABASE ? AS derived').run(index);const m=Object.fromEntries(db.prepare('SELECT key,value FROM derived.metadata').all().map(r=>[r.key,JSON.parse(r.value)]));if(m.scene!==CURRENT_SCOPE.scene||m.branch!==CURRENT_SCOPE.branch)throw Error('Scope metadata mismatch');
 const nonempty=db.prepare("SELECT CAST(x'610062' AS TEXT) v").get().v.length===1?'length(e.content)>0':"e.content<>''";
 const r=db.prepare(`SELECT count(*) rows,sum(CASE WHEN e.seq IS NULL OR e.scene!=? OR e.branch!=? OR d.kind!=e.kind OR d.t_recorded!=e.t_recorded OR NOT ((e.class='experience' AND e.kind='heard') OR (e.class='act' AND e.kind IN ('said','silent')) OR (e.class='inner' AND e.kind='wrote' AND ${nonempty})) THEN 1 ELSE 0 END) invalid FROM derived.docs d LEFT JOIN main.events e ON e.seq=d.seq`).get(m.scene,m.branch);
 if(r.invalid)throw Error('Derived scope membership mismatch');return{scene:m.scene,branch:m.branch,...r};
}finally{db.close();}}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(process.argv.slice(2).map(directory=>verifyScope(resolve(directory)))));
