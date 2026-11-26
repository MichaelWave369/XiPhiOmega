import {KeyObject,verify} from "node:crypto";
import {append,replay} from "./journal.mjs";

const SCHEMA="xpo6.permit.v1";
const AUDIENCE="xpo6.synthetic-journal";
const OPERATION="exchange.synthetic";
const MAX_BYTES=2048, MAX_TTL=60, MAX_EVENTS=36;
function check(ok){if(!ok)throw Error("execution refused");}
function label(s){check(typeof s==="string"&&s.length>=1&&s.length<=64&&/^[a-z]/.test(s)&&!/[^a-z0-9.-]/.test(s));return s;}
function hex(s,n){check(typeof s==="string"&&s.length===n&&!/[^0-9a-f]/.test(s));return s;}
function integer(n,lo,hi){check(Number.isSafeInteger(n)&&!Object.is(n,-0)&&n>=lo&&n<=hi);return n;}
function parse(raw){
 check(typeof raw==="string"&&raw.length<=MAX_BYTES&&!/[^\x20-\x7e]/.test(raw));
 const packet=JSON.parse(raw);
 check(JSON.stringify(packet)===raw&&Array.isArray(packet)&&packet.length===2);
 const [body,signature]=packet;
 check(Array.isArray(body)&&body.length===11);
 const [schema,audience,gate,issuer,nonce,revision,tip,operation,weight,issued,expires]=body;
 check(schema===SCHEMA&&audience===AUDIENCE&&operation===OPERATION);
 label(gate);label(issuer);hex(nonce,32);integer(revision,0,MAX_EVENTS-1);hex(tip,64);integer(weight,0,12);
 integer(issued,0,Number.MAX_SAFE_INTEGER);integer(expires,0,Number.MAX_SAFE_INTEGER);
 check(expires>issued&&expires-issued<=MAX_TTL);
 hex(signature,128);
 return {body,signature,gate,issuer,nonce,revision,tip,weight,issued,expires};
}

// Only the trusted host constructs a gate. The request can never supply a key,
// clock, initial journal, executable path or replacement authority.
export function createGate({gateId,issuerId,publicKey,initialJournal,clock=()=>Math.floor(Date.now()/1000)}){
 label(gateId);label(issuerId);
 check(publicKey instanceof KeyObject&&publicKey.type==="public"&&publicKey.asymmetricKeyType==="ed25519");
 check(typeof clock==="function");
 let raw=initialJournal;
 replay(raw);
 const snapshot=()=>({journal:raw,...replay(raw)});
 function execute(packet){
   const p=parse(packet);
   check(p.gate===gateId&&p.issuer===issuerId);
   check(verify(null,Buffer.from(JSON.stringify(p.body),"ascii"),publicKey,Buffer.from(p.signature,"hex")));
   const now=integer(clock(),0,Number.MAX_SAFE_INTEGER);
   check(p.issued<=now&&now<p.expires);
   const before=replay(raw);
   check(p.revision===before.revision&&p.tip===before.tip);
   // Nonce is the journal's unique operation ID: a successful append spends it.
   const next=append(raw,{id:"permit."+p.nonce,weight:p.weight,expectedRevision:p.revision,expectedTip:p.tip});
   const after=replay(next);
   check(after.revision===before.revision+1);
   const receipt={schema:"xpo6.receipt.v1",classification:"synthetic",
     authority:"local-fixture-permit",gateId,issuerId,nonce:p.nonce,
     beforeTip:before.tip,afterTip:after.tip,revision:after.revision,state:after.state};
   raw=next;
   return receipt;
 }
 return Object.freeze({execute,snapshot});
}
