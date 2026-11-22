import {test} from 'node:test';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {boundary,longInputs} from '../scripts/p9/manifest-boundary.mjs';
for(const[name,input]of longInputs)test(`P9 C7 real service: ${name}, full terms, bounded structure and exact show`,async t=>{
 const root=mkdtempSync(join(tmpdir(),'yuvi-p9-boundary-'));t.after(()=>rmSync(root,{recursive:true,force:true}));await boundary(root,name,input);
});
