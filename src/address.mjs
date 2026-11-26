const RADIX=20736, MAX_DEPTH=36;
function check(ok){if(!ok)throw Error("invalid address contract");}

function keys(v,expected){check(v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===expected);}

function label(v){check(typeof v==="string"&&v.length>=1&&v.length<=64&&/^[a-z]/.test(v)&&!/[^a-z0-9.-]/.test(v));return v;}

function space(v){check(v==="state"||v==="relation");return v;}

function digit(v){check(Number.isSafeInteger(v)&&v>=0&&v<RADIX);return v;}

function depth(v){check(Number.isSafeInteger(v)&&v>=1&&v<=MAX_DEPTH);return v;}

function formatAddress(v){keys(v,"namespace,path,space");label(v.namespace);space(v.space);check(Array.isArray(v.path));depth(v.path.length);return ["xpo3",v.namespace,v.space,...Array.from(v.path,x=>String(digit(x)).padStart(6,"0"))].join("/");}

function parseAddress(s){check(typeof s==="string"&&s.length<=336);const [prefix,namespace,k,...parts]=s.split("/");check(prefix==="xpo3");depth(parts.length);const path=parts.map(x=>{check(x.length===6&&!/[^0-9]/.test(x));return digit(Number(x));});const v={namespace:label(namespace),space:space(k),path};check(formatAddress(v)===s);return v;}

function toOrdinal(s){const v=parseAddress(s);let n=0n;for(const d of v.path)n=n*20736n+BigInt(d);return {namespace:v.namespace,space:v.space,depth:v.path.length,index:String(n)};}

function fromOrdinal(v){keys(v,"depth,index,namespace,space");label(v.namespace);space(v.space);depth(v.depth);check(typeof v.index==="string"&&v.index.length>=1&&v.index.length<=156&&!/[^0-9]/.test(v.index)&&(v.index==="0"||v.index[0]!=="0"));let n=BigInt(v.index);check(n<20736n**BigInt(v.depth));const path=Array(v.depth);for(let i=v.depth-1;i>=0;i--){path[i]=Number(n%20736n);n/=20736n;}return formatAddress({namespace:v.namespace,space:v.space,path});}

function parent(s){const v=parseAddress(s);return v.path.length===1?null:formatAddress({...v,path:v.path.slice(0,-1)});}

function child(s,d){const v=parseAddress(s);return formatAddress({...v,path:[...v.path,digit(d)]});}

function identity(namespace,id){return `xpo-id/${label(namespace)}/${label(id)}`;}

function locate(id,address){check(typeof id==="string"&&id.length<=136);const p=id.split("/");check(p.length===3&&p[0]==="xpo-id"&&identity(p[1],p[2])===id);parseAddress(address);return {identity:id,address};}

function axes(index){digit(index);return [Math.floor(index/1728),Math.floor(index/144)%12,Math.floor(index/12)%12,index%12];}

function fromAxes(v){check(Array.isArray(v)&&v.length===4);let n=0;for(const d of v){check(Number.isSafeInteger(d)&&d>=0&&d<12);n=12*n+d;}return n;}

function raster(index){digit(index);return {x:index%192,y:Math.floor(index/192)};}

function fromRaster(v){keys(v,"x,y");check(Number.isSafeInteger(v.x)&&v.x>=0&&v.x<192&&Number.isSafeInteger(v.y)&&v.y>=0&&v.y<108);return 192*v.y+v.x;}
export {formatAddress,parseAddress,toOrdinal,fromOrdinal,parent,child,identity,locate,axes,fromAxes,raster,fromRaster};
