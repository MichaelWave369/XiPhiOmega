import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {encode,decode} from "../src/capsule.mjs";
import {formatAddress,parseAddress,toOrdinal,fromOrdinal,parent,child,identity,locate,axes,fromAxes,raster,fromRaster} from "../src/address.mjs";
const RADIX=20736;
function check(ok){assert.ok(ok);}
function runReference(){
 const equal=(a,b)=>check(JSON.stringify(a)===JSON.stringify(b));
 const vectors=[];
 for(let i=0;i<RADIX;i++){
  const v={namespace:"omega",space:"state",path:[i]}, s=formatAddress(v);
  equal(parseAddress(s),v);check(fromOrdinal(toOrdinal(s))===s);check(fromAxes(axes(i))===i);check(fromRaster(raster(i))===i);
 }
 for(let i=0;i<369;i++){
  const v={namespace:["xi","phi","omega"][i%3],space:i%2?"state":"relation",path:Array.from({length:i%36+1},(_,j)=>j===0?0:(i*369+j*144+j*j)%RADIX)};
  const s=formatAddress(v);equal(parseAddress(s),v);check(fromOrdinal(toOrdinal(s))===s);
  if(v.path.length>1)check(child(parent(s),v.path.at(-1))===s);else check(parent(s)===null);
  vectors.push(s);
 }
 const maximum=formatAddress({namespace:"a".repeat(64),space:"relation",path:Array(36).fill(20735)});
 check(toOrdinal(maximum).index===(20736n**36n-1n).toString());check(fromOrdinal(toOrdinal(maximum))===maximum);vectors.push(maximum);
 const a=formatAddress({namespace:"phi",space:"state",path:[0]}), b=child(a,0), c=formatAddress({namespace:"phi",space:"relation",path:[0]});
 check(a!==b&&a!==c);check(toOrdinal(a).index===toOrdinal(b).index&&toOrdinal(a).depth!==toOrdinal(b).depth);
 const id=identity("phi","pocket-369");check(locate(id,a).identity===locate(id,b).identity);check(locate(id,a).address!==locate(id,b).address);
 equal(axes(11),[0,0,0,11]);equal(axes(12),[0,0,1,0]);equal(raster(11),{x:11,y:0});equal(raster(12),{x:12,y:0});
 const badAddresses=["","xpo3/phi/state","xpo3/phi/state/00000","xpo3/phi/state/020736","xpo3/phi/state/-00001","xpo3/phi/state/000000\n","xpo3/Φ/state/000000","xpo3/phi/unknown/000000","xpo3/phi/state/"+Array(37).fill("000000").join("/"),"xpo3/phi/state/００００００","xpo2/phi/state/000000","xpo3/phi/state/000000/","xpo3/phi/state/000001?x"];
 const ord=toOrdinal(a),badOrdinals=[{...ord,index:"00"},{...ord,index:"-1"},{...ord,index:0},{...ord,index:"20736"},{...ord,depth:0},{...ord,depth:37},{...ord,index:"1".repeat(157)},{...ord,extra:1},{...ord,index:"0\n"},{...ord,depth:true}];
 const invalidCalls=[...badAddresses.map(s=>()=>parseAddress(s)),...badOrdinals.map(v=>()=>fromOrdinal(v)),()=>child(maximum,0),()=>child(a,20736),()=>formatAddress({namespace:"phi",space:"state",path:[null]}),()=>formatAddress({namespace:"phi",space:"state",path:Array(1)}),()=>locate("pocket-369",a),()=>fromAxes([0,0,0,12]),()=>fromRaster({x:192,y:0})];
 for(const fn of invalidCalls){let refused=false;try{fn();}catch{refused=true;}check(refused);}
 return {summary:{flatAddresses:RADIX,recursiveVectors:vectors.length,negativeControls:invalidCalls.length,maxDepth:36,authority:"none"},vectors,badAddresses,badOrdinals};
}

const {summary,vectors,badAddresses,badOrdinals}=runReference();
const p=spawnSync(process.env.PYTHON||"python3",["tests/address_bridge.py"],{
 input:JSON.stringify({valid:vectors,badAddresses,badOrdinals}),encoding:"utf8",maxBuffer:4*1024*1024});
assert.equal(p.status,0,p.stderr||String(p.error||"Python failed"));
const result=JSON.parse(p.stdout);
assert.deepEqual(result.valid,vectors.map(address=>({ok:true,value:{address,ordinal:toOrdinal(address)}})));
assert.deepEqual(result.badAddresses,badAddresses.map(()=>({ok:false})));
assert.deepEqual(result.badOrdinals,badOrdinals.map(()=>({ok:false})));
for(const address of vectors){
 const v={namespace:"xpo",operation:"address.v1",atoms:[address]};
 assert.deepEqual(decode(encode(v)),v);
}
console.log(JSON.stringify({...summary,pythonParity:vectors.length,capsuleRoundtrips:vectors.length}));
