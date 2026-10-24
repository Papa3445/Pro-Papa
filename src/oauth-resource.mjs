// PP-0007: read-only MCP OAuth resource validation, independent of hosting.
// No secrets, remote tenant provisioning, token exchange or ChatGPT interception.
// Deployment requires a separately reviewed connection to an MCP HTTP handler.
import {createPublicKey, verify as verifySignature, constants} from 'node:crypto';

const MAX_JWKS_BYTES=32768, MAX_TOKEN_BYTES=32768, MAX_KEYS=20;
const safeObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const decode=(input,max)=>{
  if(typeof input!=='string'||input.length>max||!/^[A-Za-z0-9_-]+$/.test(input))
    throw Error('Invalid encoded token');
  const buf=Buffer.from(input,'base64url');
  if(buf.toString('base64url')!==input)throw Error('Noncanonical token');
  return buf;
};
const jsonPart=(input,max)=>{
  const buf=decode(input,max);
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buf));
  if(!safeObject(value))throw Error('Invalid token object');
  return value;
};
const httpsUrl=(x,allowPath)=>{
  if(typeof x!=='string'||x.length>512)throw Error('Invalid HTTPS configuration');
  const u=new URL(x);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.search||
    !u.hostname||u.pathname!=='/')throw Error('Invalid HTTPS configuration');
  // Auth0 issuer has a terminal '/', while OAuth resource ID is the bare origin.
  if(x!==(allowPath?u.origin:u.origin+'/'))throw Error('Noncanonical HTTPS configuration');
  return u;
};
const isKey=k=>safeObject(k)&&k.kty==='RSA'&&
  typeof k.kid==='string'&&/^[A-Za-z0-9_.-]{1,128}$/.test(k.kid)&&
  typeof k.n==='string'&&k.n.length>=342&&k.n.length<=1024&&
  typeof k.e==='string'&&/^[A-Za-z0-9_-]{2,12}$/.test(k.e)&&
  (k.alg===undefined||k.alg==='RS256')&&
  (k.use===undefined||k.use==='sig')&&
  (k.key_ops===undefined||(Array.isArray(k.key_ops)&&k.key_ops.includes('verify')));

async function readSmallJson(res){
  if(!res||res.ok!==true||typeof res.headers?.get!=='function')
    throw Error('JWKS unavailable');
  const type=res.headers.get('content-type');
  if(type!==null&&!/^application\/json(?:\s*;|$)/i.test(type))
    throw Error('Invalid JWKS content type');
  if(Number(res.headers.get('content-length')??0)>MAX_JWKS_BYTES)
    throw Error('JWKS too large');
  if(!res.body)throw Error('Empty JWKS');
  const reader=res.body.getReader(),parts=[];let size=0;
  try {
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_JWKS_BYTES){await reader.cancel().catch(()=>{});throw Error('JWKS too large');}
      parts.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let at=0;
  for(const part of parts){bytes.set(part,at);at+=part.byteLength;}
  const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!safeObject(data)||!Array.isArray(data.keys)||data.keys.length<1||
    data.keys.length>MAX_KEYS)throw Error('Invalid JWKS');
  const map=new Map();
  for(const key of data.keys){
    if(!isKey(key)||map.has(key.kid))throw Error('Invalid JWKS key');
    const publicKey=createPublicKey({key,format:'jwk'});
    if(publicKey.asymmetricKeyType!=='rsa'||
      (publicKey.asymmetricKeyDetails?.modulusLength??0)<2048)
      throw Error('Untrusted JWKS key');
    map.set(key.kid,publicKey);
  }
  return map;
}

/** Issuer must be the exact Auth0 tenant issuer including trailing '/'.
 * Audience is the future canonical HTTPS MCP resource and MUST be finalized
 * before registering the Auth0 API. No network work occurs during creation.
 */
export function createOAuthResourceValidator({
  issuer,resource,scope='pro_papa.read',fetchImpl=globalThis.fetch,
  now=()=>Math.floor(Date.now()/1000),cacheSeconds=300
}={}){
  const issuerUrl=httpsUrl(issuer,false),resourceUrl=httpsUrl(resource,true);
  if(!issuerUrl.hostname.endsWith('.auth0.com')||
    !/^[a-z0-9_.:-]{2,96}$/.test(scope)||
    typeof fetchImpl!=='function'||typeof now!=='function'||
    !Number.isInteger(cacheSeconds)||cacheSeconds<60||cacheSeconds>600)
    throw Error('Invalid OAuth validator configuration');
  const jwksUrl=issuerUrl.origin+'/.well-known/jwks.json';
  const metadataUrl=resourceUrl.origin+'/.well-known/oauth-protected-resource';
  let state=null,refreshing=null;
  const load=async()=>{
    const current=now();
    if(state&&current<state.expires)return state.keys;
    if(!refreshing){
      refreshing=(async()=>{
        const response=await fetchImpl(jwksUrl,{
          method:'GET',redirect:'error',
          headers:{Accept:'application/json'},
          signal:AbortSignal.timeout(5000)
        });
        const keys=await readSmallJson(response);
        state={keys,expires:now()+cacheSeconds};
        return keys;
      })().finally(()=>{refreshing=null;});
    }
    return refreshing;
  };
  const metadata=()=>({
    resource,authorization_servers:[issuer],
    scopes_supported:[scope]
  });
  const challenge=(reason='invalid_token')=>{
    const err=reason==='insufficient_scope'?'insufficient_scope':'invalid_token';
    return 'Bearer resource_metadata="'+metadataUrl+'", scope="'+scope+
      '", error="'+err+'"';
  };
  const check=async authorization=>{
    if(typeof authorization!=='string'||authorization.length>MAX_TOKEN_BYTES||
      !authorization.startsWith('Bearer '))return false;
    const token=authorization.slice(7);
    if(token.length>MAX_TOKEN_BYTES)return false;
    const parts=token.split('.');
    if(parts.length!==3)return false;
    try{
      const [encodedHeader,encodedBody,encodedSignature]=parts;
      const header=jsonPart(encodedHeader,2048),claims=jsonPart(encodedBody,16384);
      if(header.alg!=='RS256'||(header.typ!==undefined&&header.typ!=='JWT')||
        typeof header.kid!=='string'||!/^[A-Za-z0-9_.-]{1,128}$/.test(header.kid)||
        header.jku!==undefined||header.x5u!==undefined||header.jwk!==undefined||
        header.crit!==undefined)return false;
      const ts=now();
      if(!Number.isSafeInteger(ts)||!Number.isSafeInteger(claims.exp)||claims.exp<=ts||
        !Number.isSafeInteger(claims.iat)||claims.iat>ts+30||
        claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>ts+30)||
        claims.iss!==issuer||
        !(claims.aud===resource||Array.isArray(claims.aud)&&
          claims.aud.length>0&&claims.aud.length<=8&&claims.aud.includes(resource))||
        typeof claims.sub!=='string'||!claims.sub||claims.sub.length>256||
        typeof claims.scope!=='string'||claims.scope.length>2048||
        !claims.scope.split(/\s+/).includes(scope))return false;
      const signature=decode(encodedSignature,1024);
      const keys=await load();
      const key=keys.get(header.kid);
      if(!key)return false;
      return verifySignature('RSA-SHA256',
        Buffer.from(encodedHeader+'.'+encodedBody,'utf8'),
        {key,padding:constants.RSA_PKCS1_PADDING},signature);
    }catch{return false;}
  };
  return Object.freeze({
    metadata,
    challenge,
    async verifyAuthorization(authorization){return check(authorization)},
    /** Unauthenticated metadata is public and contains no token data. */
    metadataResponse(){return new Response(JSON.stringify(metadata()),{
      status:200,headers:{'Content-Type':'application/json; charset=utf-8',
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
    })},
    unauthorizedResponse(reason){
      return new Response(null,{status:401,headers:{
        'WWW-Authenticate':challenge(reason),
        'Cache-Control':'no-store','Referrer-Policy':'no-referrer'
      }});
    }
  });
}
