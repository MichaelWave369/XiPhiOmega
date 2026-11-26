import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {encode,decode} from "../src/capsule.mjs";
import {translate,toCapsule,fromCapsule} from "../src/semantic.mjs";
const REGISTRY=Object.freeze([["xi.demo.v1","∴","length"],["xi.demo.v1","⋈","duration"],["xi.demo.v1","⊚","resource"],["phi.demo.v1","∴","duration"],["phi.demo.v1","extent","length"],["phi.demo.v1","budget","resource"],["omega.demo.v1","span","length"],["omega.demo.v1","period","duration"],["omega.demo.v1","∴","resource"]].map(Object.freeze));
const UNITS=Object.freeze([["length","m","1"],["length","cm","100"],["length","mm","1000"],["duration","s","1"],["duration","ms","1000"],["resource","1","1"]].map(([c,u,s])=>Object.freeze([c,u,BigInt(s)])));

function check(v){if(!v)throw Error("semantic contract refused");}
function gcd(a,b){a=a<0n?-a:a;while(b!==0n){const t=a%b;a=b;b=t;}return a;}
function rational(n,d){check(d>0n);const g=gcd(n,d);const a=String(n/g),b=String(d/g);check(a.replace("-","").length<=36&&b.length<=36);return a+"/"+b;}
function runReference(){
 const equal=(a,b)=>check(JSON.stringify(a)===JSON.stringify(b));
 const vectors=[];
 for(let i=0;i<369;i++){
  const source=REGISTRY[i%9], choices=REGISTRY.filter(r=>r[2]===source[2]&&r[0]!==source[0]), dest=choices[Math.floor(i/9)%2];
  const units=UNITS.filter(u=>u[0]===source[2]), su=units[Math.floor(i/3)%units.length],du=units[(Math.floor(i/7)+1)%units.length];
  const record={dialect:source[0],symbol:source[1],unit:su[1],status:i%11===0?"unknown":"known",value:i%11===0?null:rational(BigInt(i-184),BigInt(i%13+1))};
  const target={dialect:dest[0],symbol:dest[1],unit:du[1]};
  const result=translate(record,target);
  equal(translate(result,{dialect:record.dialect,symbol:record.symbol,unit:record.unit}),record);
  equal(fromCapsule(toCapsule(result)),result);
  vectors.push({record,target,result});
 }
 const known={dialect:"xi.demo.v1",symbol:"∴",unit:"cm",status:"known",value:"369/1"},target={dialect:"phi.demo.v1",symbol:"extent",unit:"m"};
 check(translate(known,target).value==="369/100");
 check(translate({...known,value:"0/1"},target).value==="0/1");
 check(translate({...known,status:"unknown",value:null},target).value===null);
 const bad=[
 [{...known,dialect:"xi.demo.v2"},target],[{...known,symbol:"unknown"},target],[{...known,unit:"s"},target],[known,{dialect:"phi.demo.v1",symbol:"∴",unit:"s"}],
 [known,{...target,unit:"ms"}],[known,{...target,dialect:"omega.demo.v2"}],[{...known,value:"2/4"},target],[{...known,value:"-0/1"},target],
 [{...known,value:"01/1"},target],[{...known,value:"1/0"},target],[{...known,value:"1/1\n"},target],[{...known,value:0},target],
 [{...known,value:null},target],[{...known,status:"unknown",value:"0/1"},target],[{...known,status:"unobserved"},target],
 [{...known,extra:1},target],[known,{...target,extra:1}],[{...known,value:"1".repeat(37)+"/1"},target],
 [{...known,unit:"m",value:"9".repeat(36)+"/1"},{...target,unit:"mm"}],[{...known,value:"1/-2"},target],
 [{...known,dialect:"__proto__"},target],[{...known,symbol:"∴\u0301"},target]
 ];
 const badCaps=[{...toCapsule(known),operation:"exchange.synthetic"},{...toCapsule(known),atoms:["∴","cm","unknown","0/1"]},{...toCapsule(known),atoms:["∴","cm","known",""]},{...toCapsule(known),atoms:["∴","cm","known","1/1","extra"]},{...toCapsule(known),namespace:"xi.demo.v2"},{...toCapsule(known),atoms:Array(4)}];
 for(const fn of [...bad.map(([a,b])=>()=>translate(a,b)),...badCaps.map(c=>()=>fromCapsule(c))]){let rejected=false;try{fn()}catch{rejected=true}check(rejected);}
 return {summary:{roundtrips:vectors.length,unknownCases:vectors.filter(v=>v.record.status==="unknown").length,translationRefusals:bad.length,capsuleRefusals:badCaps.length,authority:"none"},vectors,bad};
}

const {summary,vectors,bad}=runReference();
const p=spawnSync(process.env.PYTHON||"python3",["tests/semantic_bridge.py"],{input:JSON.stringify({valid:vectors,bad}),encoding:"utf8",maxBuffer:4*1024*1024});
assert.equal(p.status,0,p.stderr||String(p.error||"Python failed"));
const result=JSON.parse(p.stdout);
assert.deepEqual(result.valid,vectors.map(v=>({ok:true,value:v.result})));
assert.deepEqual(result.bad,bad.map(()=>({ok:false})));
for(const v of vectors) {
  assert.deepEqual(fromCapsule(decode(encode(toCapsule(v.result)))),v.result);
}
console.log(JSON.stringify({...summary,pythonParity:vectors.length,wireRoundtrips:vectors.length}));
