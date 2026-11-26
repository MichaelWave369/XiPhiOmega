import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {generateKeyPairSync,sign} from "node:crypto";
import {createGate} from "../src/authority.mjs";
import {create,replay} from "../src/journal.mjs";
import {encode,decode} from "../src/capsule.mjs";
import {inspectProposal,exchange} from "../src/interop.mjs";

function python(tasks){
 const p=spawnSync(process.env.PYTHON||"python3",["tests/interop_bridge.py"],{
 input:JSON.stringify(tasks),encoding:"utf8",maxBuffer:8*1024*1024});
 assert.equal(p.status,0,p.stderr||String(p.error||"Python failed"));
 return JSON.parse(p.stdout);
}
const keys=generateKeyPairSync("ed25519");
const gate=createGate({gateId:"gate-demo",issuerId:"reviewer-demo",publicKey:keys.publicKey,
 initialJournal:create(0,12),clock:()=>1000});
const pack=body=>JSON.stringify([body,sign(null,Buffer.from(JSON.stringify(body),"ascii"),keys.privateKey).toString("hex")]);
const tasks=[];
let refused=0;
function refuse(packet,permit){
 const before=gate.snapshot();
 assert.throws(()=>exchange(packet,permit,gate));
 assert.deepEqual(gate.snapshot(),before);
 refused++;
}
for(let i=0;i<36;i++){
 const prior=gate.snapshot().journal,weight=i%13,nonce=(i+1).toString(16).padStart(32,"0");
 const request={mode:"propose",prior,weight,nonce};
 const [proposal]=python([request]);
 assert.equal(proposal.ok,true);
 const packet=Buffer.from(proposal.value,"hex"), reviewed=inspectProposal(packet,prior);
 // Fixture operator explicitly compares all reviewed fields to its own planned inputs.
 assert.equal(reviewed.weight,weight);assert.equal(reviewed.nonce,nonce);
 const snapshot=replay(prior);
 assert.equal(reviewed.tip,snapshot.tip);assert.equal(reviewed.revision,i);
 const body=["xpo6.permit.v1","xpo6.synthetic-journal","gate-demo","reviewer-demo",nonce,i,snapshot.tip,
 "exchange.synthetic",weight,1000,1030];
 const permit=pack(body);
 if(i===0){
  const mutate=(index,value)=>{const c=decode(packet);c.atoms[index]=value;return encode(c);};
  for(const [index,value] of [[0,"xpo-id/phi/other"],[1,"xpo3/phi/state/000144/000002"],
    [2,"xpo-id/phi/pocket-a"],[3,"xpo3/phi/relation/000144/000001"],[4,"∴"],[5,"m"],
    [6,"unknown"],[7,"1/13"],[7,"-1/1"],[7,"2/1"],[8,"00"],[8,"1"],
    [9,"0".repeat(64)],[10,"f".repeat(32)]])refuse(mutate(index,value),permit);
  const corrupt=Buffer.from(packet);corrupt[0]^=1;refuse(corrupt,permit);
  const c=decode(packet);c.operation="arbitrary";refuse(encode(c),permit);
  const mismatch=body.slice();mismatch[8]=1;refuse(packet,pack(mismatch));
  const bad=JSON.parse(permit);bad[1]=(bad[1][0]==="0"?"1":"0")+bad[1].slice(1);refuse(packet,JSON.stringify(bad));
 }
 const result=exchange(packet,permit,gate);
 assert.equal(gate.snapshot().revision,i+1);
 const task={mode:"verify",proposal:proposal.value,response:result.response.toString("hex"),prior,journal:result.journal};
 tasks.push(task);
 if(i===0){
   refuse(packet,permit);
   const altered=decode(result.response);altered.atoms[9]="999";
   const badResponse=encode(altered).toString("hex");
   const alteredTip=decode(result.response);alteredTip.atoms[7]="0".repeat(64);
   const otherProposal=decode(packet);otherProposal.atoms[10]="a".repeat(32);
   const negatives=[{...task,response:badResponse},{...task,response:encode(alteredTip).toString("hex")},
    {...task,proposal:encode(otherProposal).toString("hex")},{...task,journal:prior},
    {...task,prior:create(1,11)},{...task,response:"00"}];
   assert.deepEqual(python(negatives),negatives.map(()=>({ok:false})));
 }
}
const verified=python(tasks);
assert.equal(verified.length,36);
for(let i=0;i<verified.length;i++){
 const expected=replay(tasks[i].journal);
 assert.deepEqual(verified[i],{ok:true,value:{revision:i+1,tip:expected.tip,state:expected.state,
  mathematics:"verified",signature:"not-independently-verified"}});
}
assert.equal(gate.snapshot().revision,36);
const [capacity]=python([{mode:"propose",prior:gate.snapshot().journal,weight:1,nonce:"f".repeat(32)}]);
assert.deepEqual(capacity,{ok:false});
console.log(JSON.stringify({crossRuntimeExchanges:36,executorRefusals:refused,returnRefusals:6,
 proposalCapacityRefusal:1,finalRevision:36,classification:"synthetic",nativeAdapters:0}));
