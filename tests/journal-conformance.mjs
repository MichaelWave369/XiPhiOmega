import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {exchange} from "../src/reference.mjs";
import {create,append,replay,atRevision} from "../src/journal.mjs";
const next=(raw,id,w)=>{
 const r=replay(raw);
 return append(raw,{id,weight:w,expectedRevision:r.revision,expectedTip:r.tip});
};
let flat=0;
for(let a=0;a<=12;a++)for(let b=0;b<=12;b++)for(let w=0;w<=12;w++){
 const raw=next(create(a,b),"first",w),r=replay(raw),e=exchange(a,b,w);
 assert.deepEqual(r.state,[String(e.a),String(e.b),String(e.denominator)]);
 assert.deepEqual(atRevision(raw,0).state,[String(a),String(b),"12"]);
 assert.equal(JSON.parse(raw)[1][0][6],w===12?String(b-a):null);
 flat++;
}
const valid=[];
for(let i=0;i<369;i++){
 let raw=create(i%13,(i*7)%13);
 const count=i%36+1;
 for(let j=0;j<count;j++)raw=next(raw,"op."+j,(i+j*5)%13);
 const r=replay(raw);
 assert.equal(r.revision,count);
 assert.equal(12n*(BigInt(r.state[0])+BigInt(r.state[1])),BigInt(i%13+(i*7)%13)*BigInt(r.state[2]));
 assert.equal(atRevision(raw,count).tip,r.tip);
 valid.push([raw,r.tip]);
}
const root=create(0,12),one=next(root,"equalize",12),two=next(one,"later",6);
const r=replay(two);assert.deepEqual(atRevision(two,0).state,["0","12","12"]);
assert.deepEqual(atRevision(two,1).state,["144","144","288"]);
assert.equal(JSON.parse(one)[1][0][6],"12");
assert.equal(replay(one).revision,1);
assert.throws(()=>replay(one,r.tip)); // anchored truncation
assert.throws(()=>append(two,{id:"later",weight:1,expectedRevision:r.revision,expectedTip:r.tip}));
assert.throws(()=>append(two,{id:"new",weight:1,expectedRevision:1,expectedTip:r.tip}));
assert.throws(()=>append(two,{id:"new",weight:1,expectedRevision:2,expectedTip:"0".repeat(64)}));
assert.throws(()=>append(two,{id:"new",weight:13,expectedRevision:2,expectedTip:r.tip}));
assert.throws(()=>atRevision(two,3));
let full=root;for(let j=0;j<36;j++)full=next(full,"cap."+j,0);
assert.throws(()=>next(full,"overflow",1));
valid.push([full,replay(full).tip],[root,replay(root).tip]);
const bad=[["",null],[two+" ",null],["x".repeat(65537),null],[one,r.tip],
 [two,"0".repeat(64)],[JSON.stringify([JSON.parse(two)[0],JSON.parse(two)[1].reverse()]),null]];
const edit=fn=>{const v=JSON.parse(two);fn(v);return JSON.stringify(v)};
for(const fn of [v=>v[0][5]=1,v=>v[1][0][2]=11,v=>v[1][0][4][0]="1",v=>v[1][0][5][0]="143",
 v=>v[1][0][6]=null,v=>v[1][0][7]="0".repeat(64),v=>v[1][1][0]="equalize",
 v=>v[1][1][1]=0,v=>v[1][0].push("extra"),v=>v[0][2]="authorized",
 v=>v[1][0][1]=false,v=>v[1][0][2]=true])bad.push([edit(fn),null]);
// A self-rehashed but mathematically false receipt still fails replay.
bad.push([edit(v=>{const e=v[1][0];e[5][0]="143";e[7]=createHash("sha256").update(JSON.stringify(["xpo5.event.v1",e.slice(0,7)])).digest("hex");v[1].length=1}),null]);
for(const [raw,tip] of bad) assert.throws(()=>replay(raw,tip===null?undefined:tip));
const batch=[...valid,...bad];
const p=spawnSync(process.env.PYTHON||"python3",["tests/journal_bridge.py"],{input:JSON.stringify(batch),encoding:"utf8",maxBuffer:16*1024*1024});
assert.equal(p.status,0,p.stderr||String(p.error||"Python failed"));
const oracle=JSON.parse(p.stdout);
assert.deepEqual(oracle,[...valid.map(([raw,tip])=>({ok:true,value:replay(raw,tip)})),...bad.map(()=>({ok:false}))]);
console.log(JSON.stringify({flatParity:flat,pythonReplayVectors:valid.length,negativeReplayControls:bad.length,additionalLocalRefusals:7,authority:"none"}));
