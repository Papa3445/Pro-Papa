// PP-0007 — stateless Web Request/Response MCP adapter for serverless runtimes.
// Only explicit MCP tool calls are governed. This is NOT a ChatGPT turn interceptor.
import {timingSafeEqual} from 'node:crypto';
import {createReferenceHost} from './reference-host.mjs';
import {verifyReleasedExecution} from './execution-trace.mjs';
import {createMcpCallProvenance} from './mcp-call-provenance.mjs';

const MAX_BODY=65536;
const PROTOCOLS=new Set(['2025-06-18','2025-11-25']);
const CAPABILITIES=new Set(['math.sum','text.metrics','research','artifact.validate']);
const TOOL=Object.freeze({
  name:'pro_papa_execute_readonly',
  title:'Execute verified Pro-Papa read-only task',
  description:'Run bounded sum, text metrics, opt-in PDF byte checks, or allowlisted repository metadata through the host release gate. Does not govern other ChatGPT answers.',
  inputSchema:{type:'object',additionalProperties:false,required:['objective','capability'],
    properties:{
      objective:{type:'string',minLength:1,maxLength:16384},
      capability:{type:'string',enum:[...CAPABILITIES]},
      inputs:{type:'object',description:'artifact.validate: format, dataBase64, authorization, mustContain; math.sum: numbers; research: repository; text.metrics: empty object'}
    }},
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
});
const own=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const result=(id,value)=>({jsonrpc:'2.0',id,result:value});
const error=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
function json(code,payload){
  return new Response(JSON.stringify(payload),{status:code,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
function rejected(status,code,message){
  return json(status,error(null,code,message));
}
function validSecret(value){
  return typeof value==='string'&&value.length>=32&&value.length<=512;
}
function validHost(value){
  return typeof value==='string'&&value.length<=253&&
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value);
}
function authenticated(authorization,secret){
  if(typeof authorization!=='string'||!authorization.startsWith('Bearer '))return false;
  const found=Buffer.from(authorization.slice(7),'utf8');
  const expected=Buffer.from(secret,'utf8');
  return found.length===expected.length&&timingSafeEqual(found,expected);
}
async function readBounded(request){
  if(Number(request.headers.get('content-length'))>MAX_BODY)return null;
  if(!request.body)return '';
  const chunks=[];let length=0;
  const reader=request.body.getReader();
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      length+=value.byteLength;
      if(length>MAX_BODY){await reader.cancel().catch(()=>{});return null;}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
function checkedArgs(params,artifactValidationEnabled){
  if(!own(params)||params.name!==TOOL.name||!own(params.arguments))return null;
  const args=params.arguments;
  if(Object.keys(args).some(x=>!['objective','capability','inputs'].includes(x))||
    typeof args.objective!=='string'||!args.objective.trim()||
    args.objective.length>16384||!CAPABILITIES.has(args.capability)||
    (args.capability==='artifact.validate'&&!artifactValidationEnabled)||
    (args.inputs!==undefined&&!own(args.inputs)))return null;
  return {objective:args.objective,capability:args.capability,inputs:args.inputs??{}};
}
/**
 * Trust boundary:
 * - secret, canonical hostname and repository allowlist come ONLY from host config;
 * - no audit receipt writes or other external effects are permitted;
 * - only actual reference-host execution with validated trace produces success.
 */
export function createReadOnlyMcpWebHandler({
  bearerToken,hostname,oauthValidator=null,allowedOrigins=[],allowRepositories=[],
  githubResearch=false,artifactValidationEnabled=false,
  fetchImpl=globalThis.fetch,githubToken=undefined,
  // Only for direct in-process local unit tests. Never set in production Netlify function.
  allowInsecureTestTransport=false
}={}){
  const oauth=oauthValidator!==null;
  const oauthMeta=oauth?oauthValidator?.metadata?.():null;
  if((oauth?(
      bearerToken!==undefined||
      typeof oauthValidator.verifyAuthorization!=='function'||
      typeof oauthValidator.metadataResponse!=='function'||
      typeof oauthValidator.challenge!=='function'||
      typeof oauthValidator.unauthorizedResponse!=='function'||
      oauthMeta?.resource!=='https://'+hostname||
      !Array.isArray(oauthMeta?.scopes_supported)||
      oauthMeta.scopes_supported.length!==1||
      typeof oauthMeta.scopes_supported[0]!=='string'
    ):!validSecret(bearerToken))||!validHost(hostname)||hostname!==hostname.toLowerCase()||
    !Array.isArray(allowedOrigins)||allowedOrigins.some(x=>typeof x!=='string'||
      !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(x))||
    !Array.isArray(allowRepositories)||allowRepositories.length>16||
    allowRepositories.some(x=>typeof x!=='string'||!(/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i).test(x))||
    typeof githubResearch!=='boolean'||typeof artifactValidationEnabled!=='boolean'||
    typeof fetchImpl!=='function'||
    typeof allowInsecureTestTransport!=='boolean')
    throw Error('Invalid protected Netlify MCP server configuration');
  const host=createReferenceHost({
    allowedRepositories:allowRepositories,githubResearch,
    traceMode:'enforced',auditMode:'off',token:githubToken,fetchImpl,
    artifactValidationEnabled
  });
  const provenance=createMcpCallProvenance();
  let active=0;
  return async function handleMcpRequest(request){
    if(!(request instanceof Request))return rejected(400,-32600,'Invalid request');
    try{
      const url=new URL(request.url);
      if((url.protocol!=='https:'&&!allowInsecureTestTransport)||
        url.hostname.toLowerCase()!==hostname||
        !(url.pathname==='/mcp'||oauth&&url.pathname==='/.well-known/oauth-protected-resource')||
        url.search)
        return rejected(404,-32601,'Not found');
      const sentHost=request.headers.get('host');
      if(sentHost&&sentHost.toLowerCase()!==url.host.toLowerCase())
        return rejected(403,-32000,'Host forbidden');
      const origin=request.headers.get('origin');
      if(origin&&!allowedOrigins.includes(origin))
        return rejected(403,-32000,'Origin forbidden');
      if(oauth&&url.pathname==='/.well-known/oauth-protected-resource'){
        if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});
        return oauthValidator.metadataResponse();
      }
      if(!oauth&&!authenticated(request.headers.get('authorization'),bearerToken))
        return new Response(null,{status:401,headers:{
          'WWW-Authenticate':'Bearer realm="pro-papa"',
          'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
      if(request.method!=='POST')
        return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
      const contentType=request.headers.get('content-type')??'';
      const accept=request.headers.get('accept')??'';
      if(!/^application\/json(?:\s*;|$)/i.test(contentType)||
        !accept.includes('application/json')||!accept.includes('text/event-stream'))
        return rejected(406,-32600,'MCP transport headers required');
      const protocol=request.headers.get('mcp-protocol-version');
      if(protocol!==null&&!PROTOCOLS.has(protocol))
        return rejected(400,-32600,'Unsupported MCP protocol');
      const body=await readBounded(request);
      if(body===null)return rejected(413,-32600,'Request too large');
      let message;
      try{message=JSON.parse(body);}catch{return rejected(400,-32700,'Parse error');}
      if(!own(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string'||
        (message.id!==undefined&&!(typeof message.id==='string'||typeof message.id==='number')))
        return rejected(400,-32600,'Invalid request');
      if(message.id===undefined)return new Response(null,{status:202,headers:{'Cache-Control':'no-store'}});
      const id=message.id;
      if(message.method==='initialize'){
        if(!own(message.params)||!PROTOCOLS.has(message.params.protocolVersion))
          return json(200,error(id,-32602,'Unsupported protocol'));
        return json(200,result(id,{protocolVersion:message.params.protocolVersion,
          capabilities:{tools:{listChanged:false}},
          serverInfo:{name:'pro-papa-readonly',version:'0.1.0'},
          instructions:'Invoke the read-only tool explicitly for bounded work; only its tool result, not every ChatGPT reply, is host-gated.'}));
      }
      if(message.method==='ping')return json(200,result(id,{}));
      if(message.method==='tools/list'){
        const visible={...TOOL,inputSchema:{...TOOL.inputSchema,properties:{
          ...TOOL.inputSchema.properties,capability:{type:'string',enum:[...CAPABILITIES].filter(
            x=>x!=='artifact.validate'||artifactValidationEnabled)}
        }}};
        const listed=oauth?{...visible,securitySchemes:[
          {type:'oauth2',scopes:[...oauthMeta.scopes_supported]}
        ]}:visible;
        return json(200,result(id,{tools:[listed]}));
      }
      if(message.method!=='tools/call')return json(200,error(id,-32601,'Method not found'));
      if(oauth){
        const granted=await oauthValidator.verifyAuthorization(request.headers.get('authorization'));
        if(!granted){
          const challenge=oauthValidator.challenge('invalid_token')+
            ', error_description="Authenticate to use the Pro-Papa read-only tool"';
          return json(200,result(id,{isError:true,
            content:[{type:'text',text:'Authentication required'}],
            _meta:{'mcp/www_authenticate':[challenge]}}));
        }
      }
      const args=checkedArgs(message.params,artifactValidationEnabled);
      if(!args)return json(200,error(id,-32602,'Invalid tool arguments'));
      if(active>=8)return json(200,result(id,{isError:true,
        content:[{type:'text',text:'Execution unavailable: bridge at capacity'}]}));
      active++;
      let outcome;
      try{outcome=await host.execute(args);}
      finally{active--;}
      const valid=verifyReleasedExecution(outcome);
      const checked=valid?outcome:{
        status:outcome.status==='completed'?'execution_gate_failed':outcome.status,
        execution:null,audit:outcome.audit??{status:'not_requested'},
        trace:{state:'not_released',providerAuthenticated:false}
      };
      // Bind one accepted, explicitly authorized tool invocation to its actual
      // method/ID/arguments, verified capability, outcome, and released digest.
      // The per-process HMAC key is never disclosed; only the random call ID and
      // non-reversible binding travel in the response. Nothing is logged/stored.
      const binding={message,capability:args.capability,status:checked.status,
        executionSha256:valid?checked.trace.executionSha256:null};
      const callProvenance=provenance.issue(binding);
      if(!provenance.verify(callProvenance,binding))
        return rejected(500,-32603,'Internal server error');
      const released={...checked,callProvenance};
      return json(200,result(id,{isError:!valid,
        content:[{type:'text',text:JSON.stringify(released)}],
        _meta:{'pro-papa/call-provenance':callProvenance},
        ...(valid?{structuredContent:released}:{})}));
    }catch{
      return rejected(500,-32603,'Internal server error');
    }
  };
}
