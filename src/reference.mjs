function exactKeys(o, keys) {
  if (!o || typeof o !== "object" || Array.isArray(o) || Object.keys(o).sort().join("|") !== [...keys].sort().join("|")) throw Error("invalid fields");
}

function grid(n) { if (!Number.isSafeInteger(n) || n<0 || n>12) throw Error("outside grid"); return n; }

function revision(n) { if (!Number.isSafeInteger(n)||n<0||n>=Number.MAX_SAFE_INTEGER) throw Error("invalid revision");return n; }

function identity(s) { if(typeof s!=="string"||!/^[a-z][a-z0-9-]{0,63}$/.test(s)) throw Error("invalid identity");return s; }

function exchange(a,b,w) {
  grid(a);grid(b);grid(w);
  const delta=w*(b-a);
  return {a:24*a+delta,b:24*b-delta,denominator:288};
}

function execute(request,state) {
  exactKeys(request,["schema","id","operation","weight","a","b","expectedRevision"]);
  exactKeys(state,["revision","a","b","used"]);
  if(request.schema!=="xpo.001.v1"||request.operation!=="exchange.synthetic") throw Error("unsupported operation");
  identity(request.id);identity(request.a);identity(request.b);
  if(request.a===request.b||request.a!=="pocket-a"||request.b!=="pocket-b") throw Error("invalid pair");
  revision(request.expectedRevision);revision(state.revision);
  if(!Array.isArray(state.used)||state.used.length>128||new Set(state.used).size!==state.used.length) throw Error("invalid replay set");
  state.used.forEach(identity);
  if(state.used.includes(request.id)) throw Error("duplicate request");
  if(state.used.length>=128) throw Error("replay capacity");
  if(request.expectedRevision!==state.revision) throw Error("stale revision");
  const out=exchange(state.a,state.b,request.weight);
  return {schema:"xpo.001.receipt.v1",id:request.id,classification:"synthetic",authority:"none",before:{a:state.a,b:state.b,denominator:12,revision:state.revision},after:{...out,revision:state.revision+1},conservationResidual:out.a+out.b-24*(state.a+state.b),nextUsed:[...state.used,request.id]};
}

export { exchange, execute };
