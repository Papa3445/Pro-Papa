#!/usr/bin/env node
// Local-only MCP bridge. Connect to ChatGPT only after separately configuring a
// secure HTTPS tunnel/proxy and authentication. Never binds a public interface.
import {createReadOnlyMcpServer} from '../src/mcp-bridge.mjs';

function csv(value){
  return value?value.split(',').map(x=>x.trim()).filter(Boolean):[];
}
export async function main(env=process.env,log=console.error){
  const rawPort=env.PRO_PAPA_MCP_PORT??'8787';
  if(!/^\d{1,5}$/.test(rawPort))throw Error('Invalid MCP port');
  const port=Number(rawPort);
  if(port<1||port>65535)throw Error('Invalid MCP port');
  const names=csv(env.PRO_PAPA_MCP_HOSTNAMES);
  const token=env.PRO_PAPA_MCP_TOKEN??null;
  if(names.length && (typeof token!=='string'||token.length<32))
    throw Error('Externally forwarded MCP host requires bearer token');
  const required=env.PRO_PAPA_MCP_AUDIT_REQUIRED==='true';
  if(env.PRO_PAPA_MCP_AUDIT_REQUIRED&&!['true','false'].includes(env.PRO_PAPA_MCP_AUDIT_REQUIRED))
    throw Error('Invalid audit setting');
  if(required&&!env.PRO_PAPA_AUDIT_REPO)throw Error('Missing required audit repository');
  const repos=csv(env.PRO_PAPA_MCP_REPOSITORIES);
  const app=createReadOnlyMcpServer({
    allowedHosts:['127.0.0.1','localhost',...names],
    allowedOrigins:csv(env.PRO_PAPA_MCP_ORIGINS),bearerToken:token,
    allowRepositories:repos,githubResearch:repos.length>0,
    auditMode:required?'required':'off',auditRepository:env.PRO_PAPA_AUDIT_REPO,
    githubToken:env.GITHUB_TOKEN,
  });
  const address=await app.listen(port);
  log('Pro-Papa MCP read-only bridge listening on loopback port '+address.port+
    '; HTTPS and access control require a separate trusted tunnel/proxy.');
  return app;
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
  main().catch(()=>{console.error('MCP bridge startup rejected');process.exitCode=1;});
}
