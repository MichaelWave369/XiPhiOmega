import { exchange, execute } from "../src/reference.mjs";

function verifyCases() {
  let count=0, invertible=0,singular=0;
  function check(x){if(!x)throw Error("invariant failed");}
  for(let a=0;a<=12;a++)for(let b=0;b<=12;b++)for(let w=0;w<=12;w++){
    const r=exchange(a,b,w);check(r.a+r.b===24*(a+b));check(r.a>=0&&r.a<=288&&r.b>=0&&r.b<=288);
    check(r.b-r.a===2*(12-w)*(b-a));
    if(w!==12){const d=(r.b-r.a)/(2*(12-w));const s=(r.a+r.b)/24;check((s-d)/2===a&&(s+d)/2===b);invertible++;}else{check(r.a===r.b);singular++;}count++;
  }
  const state={revision:0,a:0,b:12,used:[]}, req={schema:"xpo.001.v1",id:"case-1",operation:"exchange.synthetic",weight:6,a:"pocket-a",b:"pocket-b",expectedRevision:0};
  const receipt=execute(req,state);check(receipt.after.a===72&&receipt.after.b===216&&receipt.conservationResidual===0);check(state.used.length===0&&state.revision===0);
  const bad=[[{...req,expectedRevision:1},state],[req,{...state,used:["case-1"]}],[req,{...state,a:null}],[{...req,weight:13},state],[{...req,operation:"arbitrary"},state],[{...req,extra:true},state],[{...req,b:"pocket-a"},state],[{...req,weight:NaN},state],[req,{...state,revision:-1}]];
  for(const [q,s] of bad){let rejected=false;try{execute(q,s)}catch{rejected=true}check(rejected);}
  return {cases:count,invertible,singular,negativeControls:bad.length};
}
console.log(JSON.stringify(verifyCases()));
