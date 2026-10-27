// PP-0007: bounded negative-only LIVE production HTTP smoke, no credentials.
// Does NOT certify signed-JWT positive paths, authorization scope, or latency.
import {pathToFileURL} from 'node:url';

export const PRODUCTION_ORIGIN = 'https://pro-papa-mcp.netlify.app';
const MAX_RESPONSE = 16384;
const fail = (message) => {throw Error(message);};

async function boundedJson(response) {
  if (!response || typeof response.status !== 'number') fail('no HTTP response');
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? ''))
    fail('unexpected response content type');
  if (Number(response.headers.get('content-length') ?? 0) > MAX_RESPONSE)
    fail('response too large');
  if (!response.body) fail('missing JSON response body');
  const parts = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE) {
        await reader.cancel().catch(() => {});
        fail('response too large');
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)); }
  catch { fail('invalid JSON response'); }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) fail('invalid JSON object');
  return data;
}

async function request(fetchImpl, path, options) {
  const url = PRODUCTION_ORIGIN + path;
  // Pin destination and forbid redirects; no arbitrary URL inputs or credentials.
  return fetchImpl(url, {redirect:'error', signal:AbortSignal.timeout(8000), ...options});
}

function deniedRpc(rpc, id) {
  return rpc.jsonrpc === '2.0' && rpc.id === id &&
    rpc.result?.isError === true &&
    !Object.hasOwn(rpc.result, 'structuredContent') &&
    Array.isArray(rpc.result?.content) &&
    rpc.result.content.some(v => v?.type === 'text' && v.text === 'Authentication required') &&
    Array.isArray(rpc.result?._meta?.['mcp/www_authenticate']) &&
    rpc.result._meta['mcp/www_authenticate'].some(challenge =>
      typeof challenge === 'string' && challenge.startsWith('Bearer ') &&
      challenge.includes('resource_metadata="' + PRODUCTION_ORIGIN + '/.well-known/oauth-protected-resource"') &&
      challenge.includes('error="invalid_token"'));
}

/** Only three requests, no valid bearer, no sensitive logging or mutable calls. */
export async function runProductionSmoke({fetchImpl = globalThis.fetch} = {}) {
  if (typeof fetchImpl !== 'function') fail('fetch unavailable');
  const meta = await request(fetchImpl, '/.well-known/oauth-protected-resource', {
    method:'GET', headers:{Accept:'application/json'}
  });
  if (meta.status !== 200) fail('metadata GET returned HTTP ' + meta.status);
  const document = await boundedJson(meta);
  if (document.resource !== PRODUCTION_ORIGIN ||
      !Array.isArray(document.authorization_servers) ||
      document.authorization_servers.length !== 1 ||
      !/^https:\/\/[a-z0-9.-]+\.auth0\.com\/$/i.test(document.authorization_servers[0]) ||
      !Array.isArray(document.scopes_supported) ||
      !document.scopes_supported.includes('pro_papa.read')) fail('OAuth metadata mismatch');
  if (meta.headers.get('cache-control') !== 'no-store') fail('metadata cache policy mismatch');

  const checks = [{name:'unauthenticated', id:701, authorization:null},
                  {name:'malformed_token', id:702, authorization:'Bearer intentionally-invalid-test-token'}];
  const outputs = [{name:'oauth_resource_metadata',status:meta.status,passed:true}];
  for (const check of checks) {
    const body = JSON.stringify({jsonrpc:'2.0',id:check.id,method:'tools/call',
      params:{name:'pro_papa_execute_readonly',arguments:{
        objective:'Permission denial smoke test only; no tool may execute',
        capability:'math.sum',inputs:{numbers:[3,4]}
      }}});
    const headers = {'Content-Type':'application/json',
      Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18'};
    if (check.authorization) headers.Authorization = check.authorization;
    const res = await request(fetchImpl, '/mcp', {method:'POST',headers,body});
    if (res.status !== 200) fail(check.name + ' probe returned HTTP ' + res.status);
    const rpc = await boundedJson(res);
    if (!deniedRpc(rpc,check.id)) fail(check.name + ' unexpectedly released a tool result');
    outputs.push({name:check.name,status:res.status,passed:true});
  }
  return Object.freeze({status:'passed',origin:PRODUCTION_ORIGIN,
    checks:outputs,limits:'No positive signed JWT, JWKS rotation, real authenticated tool call or whole-ChatGPT attribution verified.'});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--live') {
    console.error('Usage: node bin/pp0007-production-smoke.mjs --live (3 no-credential HTTP requests)');
    process.exitCode = 2;
  } else {
    try {
      const result = await runProductionSmoke();
      console.log(JSON.stringify(result));
    } catch (err) {
      // Error messages contain only probe names or HTTP status, never remote bodies.
      console.error('Production no-credential smoke FAILED: ' + String(err?.message ?? 'unknown'));
      process.exitCode = 1;
    }
  }
}
