import assert from "node:assert/strict";
import {createHash,generateKeyPairSync,sign,verify} from "node:crypto";
import {spawnSync} from "node:child_process";
import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {createGate} from "../src/authority.mjs";
import {create} from "../src/journal.mjs";
import {inspectProposal,exchange} from "../src/interop.mjs";

const hash=b=>createHash("sha256").update(b).digest("hex");
const bytes=v=>Buffer.from(JSON.stringify(v),"ascii");
export function demonstrate(){
 const keys=generateKeyPairSync("ed25519");
 const genesis=create(0,12), now=1000;
 // Delay full equalization until the final step so nontrivial evolution remains visible.
 const weights=Array.from({length:36},(_,i)=>i===35?12:1+i%11);
 const trust={schema:"xpo9.trust.v1",gate:"gate-demo",issuer:"reviewer-demo",
  publicKey:keys.publicKey.export({type:"spki",format:"pem"}),genesis,weights,reviewTime:now};
 const gate=createGate({gateId:trust.gate,issuerId:trust.issuer,publicKey:keys.publicKey,
  initialJournal:genesis,clock:()=>now});
 const rows=[];
 for(let i=0;i<weights.length;i++){
  const prior=gate.snapshot(),weight=weights[i],nonce=(i+1).toString(16).padStart(32,"0");
  const p=spawnSync(process.env.PYTHON||"python3",["tests/interop_bridge.py"],{
   input:JSON.stringify([{mode:"propose",prior:prior.journal,weight,nonce}]),encoding:"utf8",maxBuffer:1024*1024});
  assert.equal(p.status,0,p.stderr||String(p.error||"proposal failed"));
  const [v]=JSON.parse(p.stdout);assert.equal(v.ok,true);
  const proposal=Buffer.from(v.value,"hex"),reviewed=inspectProposal(proposal,prior.journal);
  assert.deepEqual(reviewed,{revision:i,tip:prior.tip,nonce,weight,proposalDigest:hash(proposal)});
  const body=["xpo6.permit.v1","xpo6.synthetic-journal",trust.gate,trust.issuer,nonce,i,prior.tip,
    "exchange.synthetic",weight,now,now+30];
  const permit=JSON.stringify([body,sign(null,bytes(body),keys.privateKey).toString("hex")]);
  const approvalBody=["xpo9.approval.v1",hash(proposal),hash(Buffer.from(permit,"ascii"))];
  const approval=sign(null,bytes(approvalBody),keys.privateKey).toString("hex");
  assert.ok(verify(null,bytes(approvalBody),keys.publicKey,Buffer.from(approval,"hex")));
  const result=exchange(proposal,permit,gate);
  rows.push({proposal:proposal.toString("hex"),permit,approval,response:result.response.toString("hex")});
 }
 const evidence={schema:"xpo9.evidence.v1",classification:"synthetic",rows,journal:gate.snapshot().journal};
 return {trust,evidence};
}
// Explicit CLI entrypoint; output directory must not already exist.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const dir=process.argv[2];
 if(!dir||process.argv.length!==3)throw Error("usage: node scripts/demonstrate.mjs NEW_OUTPUT_DIRECTORY");
 const {trust,evidence}=demonstrate();
 mkdirSync(dir,{recursive:false,mode:0o700});
 writeFileSync(join(dir,"trust.json"),JSON.stringify(trust,null,2)+"\n",{flag:"wx"});
 writeFileSync(join(dir,"evidence.json"),JSON.stringify(evidence,null,2)+"\n",{flag:"wx"});
 console.log(JSON.stringify({classification:"synthetic",transitions:evidence.rows.length,output:dir}));
}
