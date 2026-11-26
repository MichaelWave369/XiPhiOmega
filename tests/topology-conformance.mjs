import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {experiment,validate,run,circulant} from "../src/topology.mjs";
const result=experiment();
assert.deepEqual(experiment(),result,"deterministic regeneration");
assert.equal(result.summary.rows.length,7);
assert.equal(result.summary.edgeUpdates,10368);
assert.equal(result.holdout.length,36);
assert.ok(result.summary.trainingEnd<=result.summary.trainingStart);
assert.throws(()=>validate([0]));
assert.throws(()=>run(circulant(2),Array(144).fill(1)));
for(const r of result.summary.rows){
 assert.ok(r.rmsRelative>=0&&r.rmsRelative<=1);
 assert.ok(r.maxDrift<1e-10);
}
const p=spawnSync(process.env.PYTHON||"python3",["tests/topology_oracle.py"],{input:JSON.stringify({fixtures:result.fixtures,holdout:result.holdout}),encoding:"utf8",maxBuffer:4*1024*1024});
assert.equal(p.status,0,p.stderr||String(p.error||"Python failed"));
const oracle=JSON.parse(p.stdout);
assert.equal(oracle.pythonCases,252);
assert.ok(oracle.maxStateError<1e-12);
console.log(JSON.stringify({...result.summary,...oracle},null,2));
