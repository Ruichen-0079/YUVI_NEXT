import {spawnSync} from 'node:child_process';
import {measureReal} from './real-measure.mjs';
import {realPlan} from './real-guard.mjs';
export function runReal(args){const plan=realPlan(args);console.log(JSON.stringify({experiment:'life-r',arm:plan.arm,input_token_limit:plan.input,output_token_limit:plan.output}));
 // Credential loading and any network access happen in the child only after
 // the complete plan and approval gate above; test runs use loopback fake keys.
 const child=spawnSync(process.execPath,[new URL('./run.mjs',import.meta.url).pathname,'life-r',plan.arm,plan.out,'63','model','real'],{env:{...process.env,TZ:'Asia/Shanghai',YUVI_EVAL_MAX_INPUT:String(plan.input),YUVI_EVAL_MAX_OUTPUT:String(plan.output)},stdio:'inherit'});
 if(child.status===0)measureReal(plan.out);
 if(child.status!==0)throw Error('Real experiment stopped; inspect local partial evidence');
}
