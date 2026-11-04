// Optional Vercel Node.js function. Not wired to a production project by this file.
// The Vercel /mcp rewrite reaches /api/mcp; preserve the canonical MCP path.
import {createReadOnlyMcpWebHandler} from '../src/mcp-web.mjs';
import {createOAuthResourceValidator} from '../src/oauth-resource.mjs';

let warm=null;
const unavailable=()=>new Response('Service unavailable',{
  status:503,headers:{'Cache-Control':'no-store',
    'Content-Type':'text/plain; charset=utf-8'}
});

function configured(){
  const hostname=process.env.PRO_PAPA_MCP_PUBLIC_HOSTNAME;
  const issuer=process.env.PRO_PAPA_AUTH0_ISSUER;
  const resource=process.env.PRO_PAPA_MCP_RESOURCE;
  const flag=process.env.PRO_PAPA_MCP_ARTIFACT_VALIDATION;
  if(!hostname||!issuer||!resource||resource!=='https://'+hostname||
    (flag!==undefined&&flag!=='true'&&flag!=='false')){
    warm=null;
    throw Error('Invalid protected Vercel MCP configuration');
  }
  const artifactValidationEnabled=flag==='true';
  if(!warm||warm.hostname!==hostname||warm.issuer!==issuer||
    warm.resource!==resource||warm.artifactValidationEnabled!==artifactValidationEnabled){
    warm=null;
    const oauthValidator=createOAuthResourceValidator({issuer,resource});
    const handler=createReadOnlyMcpWebHandler({
      oauthValidator,hostname,allowedOrigins:[],
      allowRepositories:['Papa3445/Pro-Papa'],
      githubResearch:true,githubToken:null,artifactValidationEnabled
    });
    warm=Object.freeze({hostname,issuer,resource,artifactValidationEnabled,handler});
  }
  return warm.handler;
}

export default {
  async fetch(request){
    try{
      if(!(request instanceof Request))return unavailable();
      const url=new URL(request.url);
      // Vercel can expose the internal /api/mcp path. It remains authenticated.
      if(url.pathname==='/api/mcp'){
        url.pathname='/mcp';
        request=new Request(url,request);
      }
      return await configured()(request);
    }catch{
      warm=null;
      return unavailable();
    }
  }
};
