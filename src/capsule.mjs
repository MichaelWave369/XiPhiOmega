import { createHash, timingSafeEqual } from "node:crypto";
const MAGIC = Buffer.from("XPO2", "ascii");
const MAX = 16600, LIMIT = 1024, COUNT = 16;
const utf8 = new TextDecoder("utf-8", {fatal:true, ignoreBOM:true});
const hash = bytes => createHash("sha256").update(bytes).digest();
function requireOK(ok) { if (!ok) throw new Error("invalid capsule"); }
function identifier(s) {
  requireOK(typeof s === "string" && s.length >= 1 && s.length <= 64 &&
    /^[a-z]/.test(s) && !/[^a-z0-9.-]/.test(s));
  return s;
}
function field(s, limit) {
  requireOK(typeof s === "string" && s.length <= limit);
  const b = Buffer.from(s, "utf8");
  requireOK(b.length <= limit && utf8.decode(b) === s);
  const length = Buffer.alloc(2); length.writeUInt16BE(b.length);
  return Buffer.concat([length,b]);
}
export function encode(value) {
  requireOK(value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === "atoms,namespace,operation");
  const {namespace,operation,atoms} = value;
  requireOK(Array.isArray(atoms) && atoms.length <= COUNT);
  const body = Buffer.concat([MAGIC,field(identifier(namespace),64),
    field(identifier(operation),64),Buffer.from([atoms.length]),
    ...Array.from(atoms,s=>field(s,LIMIT))]);
  requireOK(body.length+32 <= MAX);
  return Buffer.concat([body,hash(body)]);
}
export function decode(packet) {
  requireOK(Buffer.isBuffer(packet) && packet.length >= 43 && packet.length <= MAX);
  const body = packet.subarray(0,-32);
  requireOK(timingSafeEqual(hash(body),packet.subarray(-32)) &&
    body.subarray(0,4).equals(MAGIC));
  let pos=4;
  function read(limit) {
    requireOK(pos+2 <= body.length);
    const n=body.readUInt16BE(pos); pos+=2;
    requireOK(n<=limit && pos+n<=body.length);
    const s=utf8.decode(body.subarray(pos,pos+n)); pos+=n;
    return s;
  }
  const namespace=identifier(read(64)), operation=identifier(read(64));
  requireOK(pos<body.length);
  const count=body[pos++]; requireOK(count<=COUNT);
  const atoms=Array.from({length:count},()=>read(LIMIT));
  requireOK(pos===body.length);
  const value={namespace,operation,atoms};
  requireOK(encode(value).equals(packet));
  return value;
}
