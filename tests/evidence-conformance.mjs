import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {generateKeyPairSync} from "node:crypto";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {demonstrate} from "../scripts/demonstrate.mjs";
import {decode,encode} from "../src/capsule.mjs";
import {replay,create} from "../src/journal.mjs";
const {trust,evidence}=demonstrate();
const dir=mkdtempSync(join(tmpdir(),"xpo9-"));
const t=join(dir,"trust.json"), e=join(dir,"evidence.json");
function run(a,b){
 writeFileSync(t,JSON.stringify(a));writeFileSync(e,JSON.stringify(b));
 return spawnSync(process.env.PYTHON||"python3",["scripts/verify_evidence.py",t,e],
   {encoding:"utf8",maxBuffer:1024*1024});
}
let negatives=0;
function reject(a,b){const p=run(a,b);assert.equal(p.status,1,p.stderr||String(p.error||"unexpected result"));negatives++;}
const flip=s=>(s[0]==="0"?"1":"0")+s.slice(1);
try{
 const good=run(trust,evidence);
 assert.equal(good.status,0,good.stderr||String(good.error||"verification failed"));
 const report=JSON.parse(good.stdout),end=replay(evidence.journal);
 assert.equal(report.verifiedTransitions,36);assert.equal(report.permitSignatures,36);
 assert.equal(report.proposalApprovalSignatures,36);
 assert.equal(report.finalTip,end.tip);assert.deepEqual(report.finalState,end.state);
 assert.equal(report.externalExecutionProven,false);
 const change=fn=>{const v=structuredClone(evidence);fn(v);return v;};
 reject(trust,change(v=>v.rows[0].approval=flip(v.rows[0].approval)));
 reject(trust,change(v=>{const p=JSON.parse(v.rows[0].permit);p[1]=flip(p[1]);v.rows[0].permit=JSON.stringify(p);}));
 reject(trust,change(v=>{const p=decode(Buffer.from(v.rows[0].proposal,"hex"));p.atoms[10]="f".repeat(32);v.rows[0].proposal=encode(p).toString("hex");}));
 reject(trust,change(v=>{const r=decode(Buffer.from(v.rows[0].response,"hex"));r.atoms[9]="999";v.rows[0].response=encode(r).toString("hex");}));
 reject(trust,change(v=>v.rows.pop()));
 reject(trust,change(v=>[v.rows[0],v.rows[1]]=[v.rows[1],v.rows[0]]));
 reject(trust,change(v=>v.journal=trust.genesis));
 reject(trust,change(v=>v.classification="measured"));
 reject({...trust,publicKey:generateKeyPairSync("ed25519").publicKey.export({type:"spki",format:"pem"})},evidence);
 reject({...trust,genesis:create(1,11)},evidence);
 reject({...trust,weights:[0,...trust.weights.slice(1)]},evidence);
 reject({...trust,reviewTime:1030},evidence);
 // Duplicate field must refuse at raw JSON parser, not silently last-wins.
 writeFileSync(t,JSON.stringify(trust));
 writeFileSync(e,JSON.stringify(evidence).replace('{"schema":','{"schema":"bad","schema":'));
 const dup=spawnSync(process.env.PYTHON||"python3",["scripts/verify_evidence.py",t,e],{encoding:"utf8"});
 assert.equal(dup.status,1);negatives++;
 console.log(JSON.stringify({...report,negativeControls:negatives}));
}finally{rmSync(dir,{recursive:true,force:true});}
