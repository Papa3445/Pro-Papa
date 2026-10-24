// PP-0007: minimal stateless Streamable HTTP MCP read-only adapter.
// This is an explicit *tool*, not a ChatGPT Project middleware or signed execution log.
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {createReferenceHost} from './reference-host.mjs';
import {verifyReleasedExecution} from './execution-trace.mjs';

const PROTOCOLS=new Set(['2025-06-18','2025-11-25']);
const VERSION='2025-11-25',NAME='pro-papa-readonly';
const PATH='/mcp',MAX_BYTES=65536;
const CAPABILITIES=new Set(['math.sum','text.metrics','research']);
const TOOL={
  name:'pro_papa_execute_readonly',
  title:'Execute verified Pro-Papa read-only task',
  description:'Execute a bounded calculation, text measurement, or explicitly allowlisted repository-metadata lookup through the Pro-Papa reference host. Returns host-local verified execution trace, NOT model reasoning. Does not govern other ChatGPT messages.',
  inputSchema:{
    type:'object',
    additionalProperties:false,
    required:['objective','capability'],
    properties:{
      objective:{type:'string',minLength:1,maxLength:16384},
      capability:{type:'string',enum:[...CAPABILITIES]},
      inputs:{type:'object',description:'For math.sum use numbers: number[]; research use repository: owner/name; text.metrics needs no inputs.'}
    }
  },
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const respond=(res,status,obj)=>{
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(obj));
};
const rpc=(id,payload,isError=false)=>({jsonrpc:'2.0',id,...(isError?{error:payload}:{result:payload})});
const fault=(id,code,message)=>rpc(id,{code,message},true);
const closed=(value)=>{if(!plain(value))return false;const allowed=['objective','capability','inputs'];return Object.keys(value).every(k=>allowed.includes(k));};
const authOK=(presented,expected)=>{
  if(typeof presented!=='string'||!presented.startsWith('Bearer '))return false;
  const v=Buffer.from(presented.slice(7)),e=Buffer.from(expected);
  return v.length===e.length&&timingSafeEqual(v,e);
};
const validName=(x)=>typeof x==='string'&&/^[a-z0-9][a-z0-9.:-]*$/i.test(x)&&x.length<=253;

export function createReadOnlyMcpServer({
  host='127.0.0.1',allowedHosts=['127.0.0.1','localhost'],allowedOrigins=[],
  bearerToken,allowRepositories=[],auditMode='off',auditRepository=null,
  githubResearch=false,fetchImpl=globalThis.fetch,
  // Local explicit server-side options, NEVER read from tool arguments.
  sourceRepository='Papa3445/Pro-Papa',githubToken=process.env.GITHUB_TOKEN,
}={}){
  if(host!=='127.0.0.1'&&host!=='::1')throw Error('MCP bridge must bind loopback; use a secure tunnel or authenticated TLS proxy');
  if(!Array.isArray(allowedHosts)||!allowedHosts.length||allowedHosts.some(x=>!validName(x))||
     !Array.isArray(allowedOrigins)||allowedOrigins.some(x=>typeof x!=='string'||
       !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(x))||
     typeof bearerToken!=='string'||bearerToken.length<32||
     !Array.isArray(allowRepositories)||auditMode!=='off'||auditRepository!==null||
     typeof githubResearch!=='boolean')throw Error('Invalid trusted MCP configuration');
  const reference=createReferenceHost({
    allowedRepositories:allowRepositories,githubResearch,auditMode:'off',
    sourceRepository,token:githubToken,fetchImpl,traceMode:'enforced'
  });
  let active=0;
  const server=createServer(async(req,res)=>{
    try{
      const origin=req.headers.origin;
      if(origin&&(typeof origin!=='string'||!allowedOrigins.includes(origin))){
        respond(res,403,fault(null,-32000,'Origin forbidden'));return;
      }
      const header=req.headers.host;
      const hostname=typeof header==='string'?header.replace(/:\d+$/,'').replace(/^\[|\]$/g,''):'';
      if(!allowedHosts.includes(hostname)){
        respond(res,403,fault(null,-32000,'Host forbidden'));return;
      }
      if(!authOK(req.headers.authorization,bearerToken)){
        res.writeHead(401,{'WWW-Authenticate':'Bearer realm="pro-papa"','Cache-Control':'no-store'});
        res.end();return;
      }
      if(req.url!==PATH){respond(res,404,fault(null,-32601,'Not found'));return;}
      if(req.method==='GET'){res.writeHead(405,{'Allow':'POST','Cache-Control':'no-store'});res.end();return;}
      if(req.method!=='POST'){res.writeHead(405,{'Allow':'POST'});res.end();return;}
      if(!String(req.headers['content-type']??'').toLowerCase().startsWith('application/json')||
         !String(req.headers.accept??'').includes('application/json')||
         !String(req.headers.accept??'').includes('text/event-stream')){
        respond(res,406,fault(null,-32600,'MCP transport headers required'));return;
      }
      const version=req.headers['mcp-protocol-version'];
      if(version!==undefined&&!PROTOCOLS.has(version)){
        respond(res,400,fault(null,-32600,'Unsupported MCP protocol'));return;
      }
      let chunks=[],size=0;
      for await(const ch of req){
        size+=ch.length;if(size>MAX_BYTES){respond(res,413,fault(null,-32600,'Request too large'));return;}
        chunks.push(ch);
      }
      let msg;
      try{msg=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{
        respond(res,400,fault(null,-32700,'Parse error'));return;
      }
      if(!plain(msg)||msg.jsonrpc!=='2.0'||typeof msg.method!=='string'||
         (msg.id!==undefined&&!(typeof msg.id==='string'||typeof msg.id==='number'))){
        respond(res,400,fault(null,-32600,'Invalid request'));return;
      }
      if(msg.id===undefined){res.writeHead(202,{'Cache-Control':'no-store'});res.end();return;}
      const id=msg.id,params=msg.params;
      if(msg.method==='initialize'){
        if(!plain(params)||!PROTOCOLS.has(params.protocolVersion)){
          respond(res,200,fault(id,-32602,'Unsupported protocol'));return;
        }
        respond(res,200,rpc(id,{protocolVersion:params.protocolVersion,capabilities:{tools:{listChanged:false}},
          serverInfo:{name:NAME,version:'0.1.0'},instructions:'Select this tool explicitly for bounded host-verified read-only tasks. Tool results never prove that other ChatGPT responses passed through Pro-Papa.'}));
        return;
      }
      if(msg.method==='ping'){respond(res,200,rpc(id,{}));return;}
      if(msg.method==='tools/list'){respond(res,200,rpc(id,{tools:[TOOL]}));return;}
      if(msg.method!=='tools/call'){respond(res,200,fault(id,-32601,'Method not found'));return;}
      if(!plain(params)||params.name!==TOOL.name||!closed(params.arguments)||
         typeof params.arguments.objective!=='string'||!params.arguments.objective.trim()||
         params.arguments.objective.length>16384||
         !CAPABILITIES.has(params.arguments.capability)||
         (params.arguments.inputs!==undefined&&!plain(params.arguments.inputs))){
        respond(res,200,fault(id,-32602,'Invalid tool arguments'));return;
      }
      if(active>=8){
        respond(res,200,rpc(id,{isError:true,content:[{type:'text',text:'Execution unavailable: bridge at capacity'}]}));return;
      }
      active++;
      let result;
      try{
        const args=params.arguments;
        result=await reference.execute({objective:args.objective,capability:args.capability,
          inputs:args.inputs??{}});
      }finally{active--;}
      const valid=verifyReleasedExecution(result);
      const output=valid?result:{
        status:result.status==='completed'?'execution_gate_failed':result.status,
        audit:result.audit??{status:'not_requested'},execution:null,
        trace:{state:'not_released',providerAuthenticated:false}
      };
      // Do not echo prompts, credentials or arbitrary tool arguments.
      respond(res,200,rpc(id,{isError:!valid,content:[{type:'text',text:JSON.stringify(output)}],
        ...(valid?{structuredContent:output}:{})}));
    }catch{
      if(!res.writableEnded)respond(res,500,fault(null,-32603,'Internal server error'));
    }
  });
  // No listener is started by importing this module.
  return {server,listen:(port=0)=>new Promise((resolve,reject)=>{
    if(!Number.isInteger(port)||port<0||port>65535){reject(Error('Invalid port'));return;}
    const error=e=>{server.off('listening',listening);reject(e)};
    const listening=()=>{server.off('error',error);resolve(server.address())};
    server.once('error',error);server.once('listening',listening);server.listen(port,host);
  }),close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
