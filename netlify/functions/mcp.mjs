// HTTPS MCP endpoint, served by Netlify Functions as /mcp.
// Runtime secrets must be scoped to Functions; no cookies or user text are logged.
import {createReadOnlyMcpWebHandler} from '../../src/mcp-web.mjs';
import {createOAuthResourceValidator} from '../../src/oauth-resource.mjs';

function env(key){
  const value=globalThis.Netlify?.env?.get?.(key);
  return value===undefined?process.env[key]:value;
}
export default async function mcp(request){
  // Fail closed: a missing secret/hostname is a deployment blocker, not open access.
  try{
    const hostname=env('PRO_PAPA_MCP_PUBLIC_HOSTNAME');
    const oauthValidator=createOAuthResourceValidator({
      issuer:env('PRO_PAPA_AUTH0_ISSUER'),
      resource:env('PRO_PAPA_MCP_RESOURCE')
    });
    const handler=createReadOnlyMcpWebHandler({
      oauthValidator,hostname,
      allowedOrigins:[],
      allowRepositories:['Papa3445/Pro-Papa'],
      githubResearch:true,
      githubToken:undefined
    });
    return await handler(request);
  }catch{
    return new Response('Service unavailable',{status:503,headers:{
      'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'
    }});
  }
}
export const config={
  path:['/mcp','/.well-known/oauth-protected-resource'],
  rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:30}
};
