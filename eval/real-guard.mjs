// Authorization is supplied by the owner, never inferred from available keys.
export function realPlan(args,env=process.env){
 const opts={};for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||args[i+1]===undefined||opts[args[i]]!==undefined)throw Error('Invalid real experiment arguments');opts[args[i]]=args[i+1];}
 if(Object.keys(opts).some(k=>!['--arm','--out','--max-input-tokens','--max-output-tokens'].includes(k)))throw Error('Invalid real experiment arguments');
 if(!/^https:\/\/github\.com\/Ruichen-0079\/YUVI_NEXT\/(issues|pull)\/\d+#issuecomment-\d+$/.test(env.YUVI_REAL_MODEL_APPROVAL??''))throw Error('Owner approval comment required: YUVI_REAL_MODEL_APPROVAL');
 const input=Number(opts['--max-input-tokens']),output=Number(opts['--max-output-tokens']);
 if(!Number.isSafeInteger(input)||input<=0||!Number.isSafeInteger(output)||output<=0)throw Error('Explicit positive input/output token limits required');
 if(!['R0','R1','R2'].includes(opts['--arm'])||!opts['--out'])throw Error('Real experiment requires arm R0/R1/R2 and a new output directory');
 return{arm:opts['--arm'],out:opts['--out'],input,output};
}
export class UsageBudget{
 input=0;output=0;requests=0;stopped=false;reason=null;
 constructor(plan){this.plan=plan;}
 add(usage){this.requests++;if(!usage||!Number.isSafeInteger(usage.prompt_tokens)||usage.prompt_tokens<0||!Number.isSafeInteger(usage.completion_tokens)||usage.completion_tokens<0){this.stopped=true;this.reason='usage_unavailable';return;}
 this.input+=usage.prompt_tokens;this.output+=usage.completion_tokens;
 if(this.input>=this.plan.input||this.output>=this.plan.output){this.stopped=true;this.reason='token_limit';}
 }
 result(){return{input_tokens:this.input,output_tokens:this.output,requests:this.requests,incomplete:this.stopped,reason:this.reason,limits:{input:this.plan.input,output:this.plan.output}};}
}
