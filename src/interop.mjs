import {createHash} from "node:crypto";
import {encode,decode} from "./capsule.mjs";
import {locate} from "./address.mjs";
import {translate} from "./semantic.mjs";
import {replay} from "./journal.mjs";

const SOURCE="xi.demo.v1", DEST="omega.demo.v1";
const A="xpo-id/phi/pocket-a", B="xpo-id/phi/pocket-b";
const LA="xpo3/phi/state/000144/000000", LB="xpo3/phi/state/000144/000001";
function check(ok){if(!ok)throw Error("interoperability refused");}
const hash=b=>createHash("sha256").update(b).digest("hex");
function hex(s,n){check(typeof s==="string"&&s.length===n&&!/[^0-9a-f]/.test(s));return s;}
function revision(s){check(typeof s==="string"&&/^(0|[1-9][0-9]?)$/.test(s)&&!s.includes("\n")&&Number(s)<36);return Number(s);}

// A proposal is not a permit. Inspecting it has no side effects.
export function inspectProposal(packet,prior){
 const c=decode(packet);
 check(c.namespace===SOURCE&&c.operation==="exchange.propose.v1"&&c.atoms.length===11);
 const [a,la,b,lb,symbol,unit,status,value,rev,tip,nonce]=c.atoms;
 locate(a,la);locate(b,lb);
 check(a===A&&b===B&&la===LA&&lb===LB);
 const out=translate({dialect:SOURCE,symbol,unit,status,value:status==="unknown"?null:value},
   {dialect:DEST,symbol:"∴",unit:"1"});
 check(status==="known"&&out.value!==null);
 const [n,d]=out.value.split("/").map(BigInt);
 check(n>=0n&&n<=d&&(12n*n)%d===0n);
 const w=Number(12n*n/d),r=revision(rev);
 hex(tip,64);hex(nonce,32);
 const current=replay(prior);
 check(current.revision===r&&current.tip===tip);
 return Object.freeze({revision:r,tip,nonce,weight:w,proposalDigest:hash(packet)});
}

// Only the operator can supply the gate and a separately signed XPO-006 permit.
// Match every field relevant to the reviewed operation before invoking the gate.
// The native permit does not sign the proposal digest or addresses.
export function exchange(packet,permit,gate){
 const before=gate.snapshot();
 const p=inspectProposal(packet,before.journal);
 check(typeof permit==="string"&&permit.length<=2048);
 const envelope=JSON.parse(permit);
 check(Array.isArray(envelope)&&envelope.length===2&&Array.isArray(envelope[0]));
 const body=envelope[0];
 check(body.length===11&&body[4]===p.nonce&&body[5]===p.revision&&body[6]===p.tip&&body[7]==="exchange.synthetic"&&body[8]===p.weight);
 const r=gate.execute(permit);
 const response=encode({namespace:DEST,operation:"exchange.result.v1",atoms:[
  p.proposalDigest,p.nonce,A,LA,B,LB,r.beforeTip,r.afterTip,String(r.revision),
  ...r.state,"synthetic","local-fixture-permit"]});
 return {response,journal:gate.snapshot().journal};
}
