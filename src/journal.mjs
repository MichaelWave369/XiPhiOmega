import {createHash} from "node:crypto";
const LIMIT=36, MAX_BYTES=65536;
function check(ok){if(!ok)throw Error("invalid continuity journal");}

function grid(v){check(Number.isSafeInteger(v)&&v>=0&&v<=12&&!Object.is(v,-0));return v;}

function transition(before,w){
 grid(w);
 const [a,b,d]=before.map(BigInt),k=BigInt(w);
 const delta=k*(b-a), x=24n*a+delta,y=24n*b-delta,z=24n*d;
 check(x>=0n&&y>=0n&&x<=z&&y<=z&&x+y===24n*(a+b));
 return [String(x),String(y),String(z)];
}
const canonical=v=>JSON.stringify(v);
const digest=v=>createHash("sha256").update(canonical(v),"utf8").digest("hex");
function label(s){check(typeof s==="string"&&s.length>=1&&s.length<=64&&/^[a-z]/.test(s)&&!/[^a-z0-9.-]/.test(s));return s;}
function genesis(a,b){return ["xpo5.v1","synthetic","none","xpo-id/phi/pocket-a","xpo-id/phi/pocket-b",grid(a),grid(b)];}
function event(id,revision,w,tip,before){
 label(id);grid(w);
 const after=transition(before,w);
 // Retain the discarded difference numerator at the input denominator.
 const scar=w===12?String(BigInt(before[1])-BigInt(before[0])):null;
 const body=[id,revision,w,tip,[...before],after,scar];
 return [...body,digest(["xpo5.event.v1",body])];
}
function inspect(raw){
 check(typeof raw==="string"&&raw.length<=MAX_BYTES&&!/[^\x20-\x7e]/.test(raw));
 const v=JSON.parse(raw);
 check(canonical(v)===raw&&Array.isArray(v)&&v.length===2);
 const [g,events]=v;
 check(Array.isArray(g)&&g.length===7&&canonical(genesis(g[5],g[6]))===canonical(g));
 check(Array.isArray(events)&&events.length<=LIMIT);
 let state=[String(g[5]),String(g[6]),"12"],tip=digest(["xpo5.genesis.v1",g]);
 const used=new Set(), history=[{revision:0,state:[...state],tip}];
 for(let i=0;i<events.length;i++){
   const e=events[i];check(Array.isArray(e)&&e.length===8);
   label(e[0]);check(!used.has(e[0]));
   const expected=event(e[0],i,e[2],tip,state);
   check(canonical(e)===canonical(expected));
   used.add(e[0]);state=expected[5];tip=expected[7];
   history.push({revision:i+1,state:[...state],tip});
 }
 return {v,used,history,revision:events.length,state:[...state],tip};
}
export function create(a,b){return canonical([genesis(a,b),[]]);}
export function replay(raw,expectedTip){
 const r=inspect(raw);
 if(expectedTip!==undefined){check(typeof expectedTip==="string"&&expectedTip.length===64&&!/[^0-9a-f]/.test(expectedTip)&&r.tip===expectedTip);}
 return {revision:r.revision,state:r.state,tip:r.tip,classification:"synthetic",authority:"none"};
}
export function append(raw,request){
 const r=inspect(raw);
 check(request&&typeof request==="object"&&!Array.isArray(request)&&Object.keys(request).sort().join(",")==="expectedRevision,expectedTip,id,weight");
 label(request.id);grid(request.weight);
 check(Number.isSafeInteger(request.expectedRevision)&&!Object.is(request.expectedRevision,-0)&&request.expectedRevision===r.revision&&request.expectedTip===r.tip);
 check(!r.used.has(request.id)&&r.revision<LIMIT);
 const out=canonical([r.v[0],[...r.v[1],event(request.id,r.revision,request.weight,r.tip,r.state)]]);
 inspect(out);return out;
}
export function atRevision(raw,revision){
 const r=inspect(raw);check(Number.isSafeInteger(revision)&&!Object.is(revision,-0)&&revision>=0&&revision<=r.revision);
 return r.history[revision];
}
