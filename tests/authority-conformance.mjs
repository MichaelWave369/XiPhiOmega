import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createGate} from "../src/authority.mjs";
import {create,replay} from "../src/journal.mjs";

const good=generateKeyPairSync("ed25519"),bad=generateKeyPairSync("ed25519");
const wrongType=generateKeyPairSync("x25519");
let now=1000;
const root=create(0,12);
const config={gateId:"gate-a",issuerId:"issuer-a",publicKey:good.publicKey,initialJournal:root,clock:()=>now};
const gate=createGate(config);
const make=(g,n=1,w=12)=>{
 const r=g.snapshot();
 return ["xpo6.permit.v1","xpo6.synthetic-journal","gate-a","issuer-a",n.toString(16).padStart(32,"0"),r.revision,r.tip,"exchange.synthetic",w,now,now+30];
};
const pack=(body,key=good.privateKey)=>JSON.stringify([body,sign(null,Buffer.from(JSON.stringify(body),"ascii"),key).toString("hex")]);
const replace=(body,i,v)=>body.map((x,j)=>j===i?v:x);
let refused=0;
function refuse(g,packet){
 const before=g.snapshot();
 assert.throws(()=>g.execute(packet));
 assert.deepEqual(g.snapshot(),before,"refusal must not mutate journal");
 refused++;
}
const b=make(gate);
const first=pack(b);
const altered=JSON.parse(first);altered[0][8]=1;
refuse(gate,JSON.stringify(altered));
const corrupt=JSON.parse(first);corrupt[1]=(corrupt[1][0]==="0"?"1":"0")+corrupt[1].slice(1);
refuse(gate,JSON.stringify(corrupt));
refuse(gate,pack(b,bad.privateKey));
for(const [i,v] of [[0,"xpo6.permit.v2"],[1,"other"],[2,"gate-b"],[3,"issuer-b"],
 [4,"0".repeat(31)],[5,1],[6,"0".repeat(64)],[7,"arbitrary"],[8,13],[8,true],
 [9,1001],[10,1000],[10,1061],[9,-1],[8,"12"],[5,false]])refuse(gate,pack(replace(b,i,v)));
for(const raw of ["",first+" ",JSON.stringify({body:b,signature:"0".repeat(128)}),JSON.stringify([b,"0".repeat(127)]),"x".repeat(2049),JSON.stringify([b,"0".repeat(128),0])])refuse(gate,raw);
now=1030;refuse(gate,first);now=1000;
const receipt=gate.execute(first);
assert.deepEqual(receipt.state,["144","144","288"]);
assert.equal(receipt.beforeTip,replay(root).tip);
assert.equal(receipt.afterTip,gate.snapshot().tip);
assert.equal(receipt.authority,"local-fixture-permit");
assert.equal(gate.snapshot().authority,"none");
refuse(gate,first); // stale state + spent nonce
refuse(gate,pack(make(gate,1,6))); // freshly signed same nonce at current tip
const race1=pack(make(gate,2,6)),race2=pack(make(gate,3,6));
gate.execute(race1);refuse(gate,race2); // same prior revision
const other=createGate({...config,gateId:"gate-b"});
refuse(other,first);
assert.throws(()=>createGate({...config,publicKey:good.privateKey}));
assert.throws(()=>createGate({...config,publicKey:wrongType.publicKey}));
assert.throws(()=>createGate({...config,initialJournal:"invalid"}));
const badClock=createGate({...config,clock:()=>NaN});refuse(badClock,first);

// Successful operations through the fixed journal budget.
for(let i=4;gate.snapshot().revision<36;i++)gate.execute(pack(make(gate,i,i%13)));
assert.equal(gate.snapshot().revision,36);
refuse(gate,pack(make(gate,100,1)));
const final=gate.snapshot();
const p=spawnSync(process.env.PYTHON||"python3",["tests/journal_bridge.py"],{input:JSON.stringify([[final.journal,final.tip]]),encoding:"utf8",maxBuffer:1024*1024});
assert.equal(p.status,0,p.stderr||String(p.error||"Python failed"));
assert.deepEqual(JSON.parse(p.stdout),[{ok:true,value:replay(final.journal,final.tip)}]);
// Explicitly demonstrate the limitation: a recreated old instance can replay.
const reset=createGate(config);assert.equal(reset.execute(first).afterTip,receipt.afterTip);
console.log(JSON.stringify({authorizedTransitions:36,refusedWithoutMutation:refused,invalidHostConfigurations:3,pythonFinalReplay:true,rollbackAcrossRecreation:"not protected"}));
