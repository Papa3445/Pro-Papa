// Vercel reserves /.well-known against rewrites. Generate public RFC 9728 JSON
// from the same trusted resource/issuer configuration as the MCP function.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createOAuthResourceValidator} from '../src/oauth-resource.mjs';

export function renderMetadata(env=process.env){
  const hostname=env.PRO_PAPA_MCP_PUBLIC_HOSTNAME;
  const issuer=env.PRO_PAPA_AUTH0_ISSUER;
  const resource=env.PRO_PAPA_MCP_RESOURCE;
  if(typeof hostname!=='string'||!hostname||
    typeof resource!=='string'||resource!=='https://'+hostname){
    throw Error('Invalid Vercel metadata resource/hostname configuration');
  }
  const validator=createOAuthResourceValidator({issuer,resource});
  return JSON.stringify(validator.metadata(),null,2)+'\n';
}

export function writeMetadata({env=process.env,outputDir='public'}={}){
  const content=renderMetadata(env); // fail before touching disk
  const folder=join(outputDir,'.well-known');
  mkdirSync(folder,{recursive:true});
  const path=join(folder,'oauth-protected-resource');
  writeFileSync(path,content,{encoding:'utf8',mode:0o644});
  return path;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  writeMetadata();
}
