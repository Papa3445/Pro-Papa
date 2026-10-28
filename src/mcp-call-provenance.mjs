// PP-0009: privacy-limited, host-local binding for *explicit* MCP tool calls.
// This is NOT a signed provider record, durable log, or ChatGPT turn interceptor.
import {randomBytes,randomUUID,createHmac,timingSafeEqual} from 'node:crypto';

const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const own=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const KEYS=['schemaVersion','id','method','capability','status','executionSha256',
  'requestHmacSha256','scope','retention','providerAuthenticated'];
function fieldsValid(call){
  return own(call)&&Object.keys(call).length===KEYS.length&&
    KEYS.every(k=>Object.hasOwn(call,k))&&call.schemaVersion===1&&
    typeof call.id==='string'&&UUID.test(call.id)&&
    call.method==='tools/call'&&typeof call.capability==='string'&&
    /^[a-z][a-z.]{1,63}$/.test(call.capability)&&
    typeof call.status==='string'&&/^[a-z_]{3,64}$/.test(call.status)&&
    (call.executionSha256===null||
      typeof call.executionSha256==='string'&&SHA.test(call.executionSha256))&&
    typeof call.requestHmacSha256==='string'&&SHA.test(call.requestHmacSha256)&&
    call.scope==='single_explicit_mcp_tool_call'&&call.retention==='response_only'&&
    call.providerAuthenticated===false;
}
function inputValid(message,capability,status,executionSha256){
  return own(message)&&message.jsonrpc==='2.0'&&message.method==='tools/call'&&
    (typeof message.id==='number'&&Number.isFinite(message.id)||
     typeof message.id==='string')&&own(message.params)&&
    typeof capability==='string'&&/^[a-z][a-z.]{1,63}$/.test(capability)&&
    message.params.arguments?.capability===capability&&
    typeof status==='string'&&/^[a-z_]{3,64}$/.test(status)&&
    (executionSha256===null||typeof executionSha256==='string'&&SHA.test(executionSha256));
}
// Canonicalize the ENTIRE parsed JSON-RPC envelope, including accepted
// extension fields. This binds JSON values, not whitespace or raw wire bytes.
// Bound recursion, reject non-JSON values and non-finite numeric extensions;
// never expose this serialization or the per-handler secret in the response.
function canonicalJson(value,depth=0,limit={nodes:0}){
  if(depth>64||++limit.nodes>16384)throw Error('Invalid JSON-RPC envelope');
  if(value===null||typeof value==='string'||typeof value==='boolean')
    return JSON.stringify(value);
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw Error('Invalid JSON-RPC envelope');
    return JSON.stringify(value);
  }
  if(Array.isArray(value)){
    if(Object.getPrototypeOf(value)!==Array.prototype)
      throw Error('Invalid JSON-RPC envelope');
    const items=[];
    for(let i=0;i<value.length;i++){
      if(!Object.hasOwn(value,i))throw Error('Invalid JSON-RPC envelope');
      items.push(canonicalJson(value[i],depth+1,limit));
    }
    return '['+items.join(',')+']';
  }
  if(!own(value))throw Error('Invalid JSON-RPC envelope');
  const keys=Object.keys(value).sort();
  return '{'+keys.map(k=>JSON.stringify(k)+':'+
    canonicalJson(value[k],depth+1,limit)).join(',')+'}';
}
const compare=(a,b)=>timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
export function createMcpCallProvenance(){
  // Per-handler random key. Never persisted, returned or logged. Each request is
  // independently random-salted; no unhashed prompt / token / artifact bytes stored.
  const key=randomBytes(32);
  function mac(message,call){
    return createHmac('sha256',key).update(JSON.stringify([
      call.id,canonicalJson(message),
      call.capability,call.status,call.executionSha256
    ])).digest('hex');
  }
  return Object.freeze({
    issue({message,capability,status,executionSha256=null}){
      if(!inputValid(message,capability,status,executionSha256))
        throw Error('Invalid explicit MCP provenance request');
      const record={schemaVersion:1,id:randomUUID(),method:'tools/call',
        capability,status,executionSha256,requestHmacSha256:'',
        scope:'single_explicit_mcp_tool_call',retention:'response_only',
        providerAuthenticated:false};
      record.requestHmacSha256=mac(message,record);
      return Object.freeze(record);
    },
    verify(record,{message,capability,status,executionSha256=null}){
      try{
        return fieldsValid(record)&&
          inputValid(message,capability,status,executionSha256)&&
          record.capability===capability&&record.status===status&&
          record.executionSha256===executionSha256&&
          compare(record.requestHmacSha256,mac(message,record));
      }catch{return false;}
    }
  });
}
