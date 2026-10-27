// HTTPS MCP endpoint, served by Netlify Functions as /mcp.
// Runtime secrets must be scoped to Functions; no cookies or user text are logged.
import {createReadOnlyMcpWebHandler} from '../../src/mcp-web.mjs';
import {createOAuthResourceValidator} from '../../src/oauth-resource.mjs';

// Reuse public config + trusted handler in ONE warm Netlify instance only.
// Never cache a bearer, raw request content or user identity. Not a global quota.
let warmHandler=null;
function env(key){
  const value=globalThis.Netlify?.env?.get?.(key);
  return value===undefined?process.env[key]:value;
}
export default async function mcp(request){
  try{
    const hostname=env('PRO_PAPA_MCP_PUBLIC_HOSTNAME');
    const issuer=env('PRO_PAPA_AUTH0_ISSUER');
    const resource=env('PRO_PAPA_MCP_RESOURCE');
    const artifactSetting=env('PRO_PAPA_MCP_ARTIFACT_VALIDATION');
    if(artifactSetting!==undefined&&!['true','false'].includes(artifactSetting)){
      warmHandler=null;
      throw Error('Invalid protected artifact validation setting');
    }
    const artifactValidationEnabled=artifactSetting==='true';
    if(typeof hostname!=='string'||!hostname||
       typeof issuer!=='string'||!issuer||
       typeof resource!=='string'||!resource){
      warmHandler=null;
      throw Error('Missing protected resource configuration');
    }
    let current=warmHandler;
    if(!current||current.hostname!==hostname||
       current.issuer!==issuer||current.resource!==resource||
       current.artifactValidationEnabled!==artifactValidationEnabled){
      // Invalidate before revalidating. Invalid configuration cannot
      // fall back to a previously privileged handler.
      warmHandler=null;
      const oauthValidator=createOAuthResourceValidator({issuer,resource});
      const handler=createReadOnlyMcpWebHandler({
        oauthValidator,hostname,allowedOrigins:[],
        allowRepositories:['Papa3445/Pro-Papa'],
        githubResearch:true,githubToken:undefined,artifactValidationEnabled
      });
      current=Object.freeze({hostname,issuer,resource,artifactValidationEnabled,handler});
      warmHandler=current;
    }
    // Snapshot handles a concurrent config replacement safely.
    return await current.handler(request);
  }catch{
    warmHandler=null;
    return new Response('Service unavailable',{status:503,headers:{
      'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'
    }});
  }
}
export const config={
  path:['/mcp','/.well-known/oauth-protected-resource'],
  // Per-IP Netlify rate limiting is NOT distributed request concurrency.
  rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:30}
};
