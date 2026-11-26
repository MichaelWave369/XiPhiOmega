const N=144, ROUNDS=36, ALPHA=1/8;
function check(ok){if(!ok)throw Error("topology invariant");}

function rng(seed){let s=seed>>>0;return n=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)%n;};}

function key(a,b){return Math.min(a,b)*N+Math.max(a,b);}

function edge(k){return [Math.floor(k/N),k%N];}

function canonical(edges){return [...edges].sort((a,b)=>a-b);}

function circulant(stride){const set=new Set();for(let i=0;i<N;i++)for(const d of [1,stride])set.add(key(i,(i+d)%N));return canonical(set);}

function torus(){const set=new Set();for(let y=0;y<12;y++)for(let x=0;x<12;x++){const i=y*12+x;set.add(key(i,y*12+(x+1)%12));set.add(key(i,((y+1)%12)*12+x));}return canonical(set);}

function validate(g){check(g.length===288&&new Set(g).size===288);const adj=Array.from({length:N},()=>[]);for(const k of g){const [a,b]=edge(k);check(a>=0&&a<b&&b<N);adj[a].push(b);adj[b].push(a);}check(adj.every(x=>x.length===4));const seen=new Set([0]),q=[0];for(let i=0;i<q.length;i++)for(const b of adj[q[i]])if(!seen.has(b)){seen.add(b);q.push(b);}check(seen.size===N);}

function swap(g,rand){const i=rand(g.length),j=rand(g.length);if(i===j)return null;const [a,b]=edge(g[i]);let [c,d]=edge(g[j]);if(rand(2))[c,d]=[d,c];if(new Set([a,b,c,d]).size!==4)return null;const p=key(a,c),q=key(b,d),s=new Set(g);if(s.has(p)||s.has(q))return null;s.delete(g[i]);s.delete(g[j]);s.add(p);s.add(q);const next=canonical(s);try{validate(next);}catch{return null;}return next;}

function tasks(seed,count){const rand=rng(seed),out=[];for(let i=0;i<count;i++){const family=["impulse","block","binary"][i%3],x=Array(N).fill(0),start=rand(N);if(family==="impulse")x[start]=1;else if(family==="block")for(let j=0;j<12;j++)x[(start+j)%N]=1;else{for(let j=0;j<N;j++)x[j]=rand(2);x[0]=0;x[1]=1;}out.push({family,x});}return out;}

function run(g,x,rounds=ROUNDS){const mean=x.reduce((a,b)=>a+b,0)/N,initial=x.reduce((s,v)=>s+(v-mean)**2,0);check(initial>0);const sum=x.reduce((a,b)=>a+b,0);let cur=x.slice(),maxDrift=0;const edges=g.map(edge);for(let t=0;t<rounds;t++){const next=cur.slice();for(const [a,b] of edges){const delta=ALPHA*(cur[b]-cur[a]);next[a]+=delta;next[b]-=delta;}check(next.every(v=>v>=-1e-12&&v<=1+1e-12));const drift=Math.abs(next.reduce((a,b)=>a+b,0)-sum);maxDrift=Math.max(maxDrift,drift);check(drift<1e-10);cur=next;}const squared=cur.reduce((s,v)=>s+(v-mean)**2,0)/initial;return {squared,maxDrift,final:cur};}

function score(g,set){return set.reduce((s,t)=>s+run(g,t.x).squared,0)/set.length;}

function wire(g){return g.reduce((s,k)=>{const [a,b]=edge(k);return s+Math.min(b-a,N-(b-a));},0);}

function experiment(){const train=tasks(0x12345678,9),holdout=tasks(0x9abcdef0,36);
const graphs={local:circulant(2),atlas:circulant(12),fibonacci:circulant(13),stride33:circulant(33),torus:torus()};
let random=graphs.atlas,rr=rng(0x13579bdf),randomSwaps=0;for(let i=0;i<369;i++){const cand=swap(random,rr);if(cand){random=cand;randomSwaps++;}}graphs.random=random;
let adaptive=graphs.atlas,ar=rng(0x2468ace1),best=score(adaptive,train),start=best,accepted=0,evaluated=0;for(let i=0;i<72;i++){const cand=swap(adaptive,ar);if(!cand)continue;evaluated++;const val=score(cand,train);if(val<best){adaptive=cand;best=val;accepted++;}}graphs.adaptive=adaptive;
const rows=[],fixtures=[];for(const [name,g] of Object.entries(graphs)){validate(g);const outcomes=holdout.map(t=>run(g,t.x));const meanSquared=outcomes.reduce((s,r)=>s+r.squared,0)/outcomes.length;const byFamily={};for(const family of ["impulse","block","binary"]){const v=outcomes.filter((_,i)=>holdout[i].family===family);byFamily[family]=Math.sqrt(v.reduce((s,r)=>s+r.squared,0)/v.length);}rows.push({name,rmsRelative:Math.sqrt(meanSquared),worstRelative:Math.sqrt(Math.max(...outcomes.map(r=>r.squared))),wire:wire(g),maxDrift:Math.max(...outcomes.map(r=>r.maxDrift)),byFamily});fixtures.push({name,edges:g.map(edge),outcomes:outcomes.map(r=>r.final)});}
check(best<=start);check(randomSwaps>0);check(evaluated>0);return {summary:{nodes:N,edges:288,rounds:ROUNDS,edgeUpdates:288*ROUNDS,holdout:36,train:9,randomSwaps,adaptiveProposals:72,evaluated,accepted,trainingStart:start,trainingEnd:best,searchEdgeUpdates:(evaluated+1)*9*ROUNDS*288,rows},fixtures,holdout};}
export {experiment,validate,run,circulant};
