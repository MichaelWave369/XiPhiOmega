const REGISTRY=Object.freeze([["xi.demo.v1","∴","length"],["xi.demo.v1","⋈","duration"],["xi.demo.v1","⊚","resource"],["phi.demo.v1","∴","duration"],["phi.demo.v1","extent","length"],["phi.demo.v1","budget","resource"],["omega.demo.v1","span","length"],["omega.demo.v1","period","duration"],["omega.demo.v1","∴","resource"]].map(Object.freeze));
const UNITS=Object.freeze([["length","m","1"],["length","cm","100"],["length","mm","1000"],["duration","s","1"],["duration","ms","1000"],["resource","1","1"]].map(([c,u,s])=>Object.freeze([c,u,BigInt(s)])));
function check(v){if(!v)throw Error("semantic contract refused");}

function fields(v,k){check(v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k);}

function binding(dialect,symbol,unit){check(typeof dialect==="string"&&typeof symbol==="string"&&typeof unit==="string");const r=REGISTRY.find(r=>r[0]===dialect&&r[1]===symbol);check(r);const u=UNITS.find(u=>u[0]===r[2]&&u[1]===unit);check(u);return {concept:r[2],scale:u[2]};}

function gcd(a,b){a=a<0n?-a:a;while(b!==0n){const t=a%b;a=b;b=t;}return a;}

function rational(n,d){check(d>0n);const g=gcd(n,d);const a=String(n/g),b=String(d/g);check(a.replace("-","").length<=36&&b.length<=36);return a+"/"+b;}

function parseRational(s){check(typeof s==="string"&&s.length<=74&&!/[^0-9/-]/.test(s)&&/^-?(0|[1-9][0-9]{0,35})\/[1-9][0-9]{0,35}$/.test(s));const [n,d]=s.split("/").map(BigInt);check(rational(n,d)===s);return [n,d];}

function validate(record){fields(record,"dialect,status,symbol,unit,value");const b=binding(record.dialect,record.symbol,record.unit);check(record.status==="known"||record.status==="unknown");if(record.status==="known")parseRational(record.value);else check(record.value===null);return b;}

function translate(record,target){const src=validate(record);fields(target,"dialect,symbol,unit");const dst=binding(target.dialect,target.symbol,target.unit);check(src.concept===dst.concept);let value=null;if(record.status==="known"){const [n,d]=parseRational(record.value);value=rational(n*dst.scale,d*src.scale);}return {dialect:target.dialect,symbol:target.symbol,unit:target.unit,status:record.status,value};}

function toCapsule(record){validate(record);return {namespace:record.dialect,operation:"semantic.quantity.v1",atoms:[record.symbol,record.unit,record.status,record.value===null?"":record.value]};}

function fromCapsule(c){fields(c,"atoms,namespace,operation");check(c.operation==="semantic.quantity.v1"&&Array.isArray(c.atoms)&&c.atoms.length===4&&Array.from(c.atoms).every(x=>typeof x==="string"));const [symbol,unit,status,value]=c.atoms;check(status!=="unknown"||value==="");const record={dialect:c.namespace,symbol,unit,status,value:status==="unknown"?null:value};validate(record);return record;}
export {translate,toCapsule,fromCapsule};
