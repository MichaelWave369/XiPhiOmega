import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {encode,decode} from "../src/capsule.mjs";

const example={namespace:"xi",operation:"transport",atoms:["Ξ","Φ","Ω","κ\u0304","é","e\u0301","🌱","\uFEFF","\u0000",""]};
const values=[example,{namespace:"phi",operation:"transport",atoms:[]},
  {namespace:"omega",operation:"unknown.operation",atoms:["x"]},
  {namespace:"a".repeat(64),operation:"b".repeat(64),atoms:Array(16).fill("🌱".repeat(256))}];
const symbols=["Ξ","Φ","Ω","κ\u0304","é","e\u0301","🌱","\uFEFF","\u0000","", "漢字","\n","abc"];
for(let i=0;i<369;i++) values.push({namespace:["xi","phi","omega"][i%3],
  operation:"op."+i,atoms:Array.from({length:i%17},(_,j)=>symbols[(i*7+j*5)%symbols.length].repeat(1+(i+j)%7))});
const frames=values.map(v=>encode(v));
for(let i=0;i<values.length;i++){
  assert.deepEqual(decode(frames[i]),values[i]);
  assert.deepEqual(encode(decode(frames[i])),frames[i]);
}
assert.notDeepEqual(encode({...example,namespace:"phi"}),frames[0]);
assert.notDeepEqual(encode({...example,atoms:["é"]}),encode({...example,atoms:["e\u0301"]}));
const badValues=[null,[],{...example,extra:1},{...example,namespace:"xi\n"},
  {...example,operation:""},{...example,atoms:[1]},{...example,atoms:["\uD800"]},
  {...example,atoms:["a".repeat(1025)]},{...example,atoms:Array(17).fill("")},
  {...example,namespace:"Ω"},{...example,operation:"x".repeat(65)}];
for(const v of badValues) assert.throws(()=>encode(v));
const seal=b=>Buffer.concat([b,createHash("sha256").update(b).digest()]);
const sample=frames[0], body=sample.subarray(0,-32);
const badFrames=[Buffer.alloc(0),sample.subarray(0,-1),Buffer.concat([sample,Buffer.from([0])]),
  Buffer.alloc(16601),seal(Buffer.concat([body,Buffer.from([0])])),
  seal(Buffer.concat([Buffer.from("BAD!"),body.subarray(4)])),
  seal(Buffer.from([88,80,79,50,0,1,120,0,1,121,1,0,1,255])),
  seal(Buffer.from([88,80,79,50,0,1,120,0,1,121,17])),
  seal(Buffer.from([88,80,79,50,255,255,120,0,1,121,0]))];
for(let i=0;i<sample.length;i++){const b=Buffer.from(sample);b[i]^=1;badFrames.push(b);}
for(const b of badFrames) assert.throws(()=>decode(b));
const input=JSON.stringify({encode:[...values,...badValues],decode:[...frames,...badFrames].map(b=>b.toString("hex"))});
const p=spawnSync(process.env.PYTHON||"python3",["tests/capsule_bridge.py"],{input,encoding:"utf8",maxBuffer:16*1024*1024});
assert.equal(p.status,0,p.stderr||String(p.error||"Python failed"));
const result=JSON.parse(p.stdout);
assert.equal(result.encoded.length,values.length+badValues.length);
assert.equal(result.decoded.length,frames.length+badFrames.length);
for(let i=0;i<values.length;i++){
  assert.deepEqual(result.encoded[i],{ok:true,value:frames[i].toString("hex")});
  assert.deepEqual(result.decoded[i],{ok:true,value:values[i]});
  assert.deepEqual(decode(Buffer.from(result.encoded[i].value,"hex")),values[i]);
}
for(const r of result.encoded.slice(values.length)) assert.deepEqual(r,{ok:false});
for(const r of result.decoded.slice(frames.length)) assert.deepEqual(r,{ok:false});
console.log(JSON.stringify({crossLanguageVectors:values.length,rejectedValues:badValues.length,rejectedFrames:badFrames.length,authority:"none"}));
