// PP-0008: bounded, mechanical PDF inspection, not a renderer or quality audit.
// Deliberately accepts only classic-xref, unencrypted, text-based PDFs.
// No filesystem/network operations, native tools, or retained artifact bytes.
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

const MAX_PDF_BYTES=32768;
const MAX_TEXT_BYTES=262144;
const SHA=/^[a-f0-9]{64}$/;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const reject=()=>{throw Error('Artifact validation denied: invalid or unsupported PDF');};
const ref=(source,key)=>{
  const match=new RegExp('/'+key+'\\s+(\\d+)\\s+0\\s+R\\b').exec(source);
  if(!match)reject();
  return Number(match[1]);
};
function decodeString(raw){
  const bytes=[];
  for(let i=0;i<raw.length;i++){
    if(raw[i]==='\\'){
      i++;
      if(i===raw.length)reject();
      if(/[0-7]/.test(raw[i])){
        let octal=raw[i];
        while(octal.length<3&&i+1<raw.length&&/[0-7]/.test(raw[i+1]))octal+=raw[++i];
        bytes.push(parseInt(octal,8));
      }else{
        const escapes={n:10,r:13,t:9,b:8,f:12};
        if(Object.hasOwn(escapes,raw[i]))bytes.push(escapes[raw[i]]);
        else if('()\\'.includes(raw[i]))bytes.push(raw.charCodeAt(i));
        else if(raw[i]==='\n')continue;
        else reject();
      }
    }else bytes.push(raw.charCodeAt(i));
  }
  if(bytes.some(n=>n>126||(n<32&&n!==9&&n!==10&&n!==13)))reject();
  return Buffer.from(bytes).toString('ascii');
}
// A deliberately small PDF content-stream lexer. Comments are not executable
// tokens and a parenthesized literal string cannot introduce PDF operators.
function contentTokens(stream){
  const raw=stream.toString('latin1');
  const tokens=[];
  const delim=ch=>ch===undefined||/[\x00\t\n\f\r /%()[\]{}<>]/.test(ch);
  for(let i=0;i<raw.length;){
    const ch=raw[i];
    if(/[\x00\t\n\f\r ]/.test(ch)){i++;continue;}
    if(ch==='%'){
      while(i<raw.length&&!/[\n\r]/.test(raw[i]))i++;
      continue;
    }
    if(ch==='('){
      let depth=1;const start=++i;
      while(i<raw.length&&depth>0){
        if(raw[i]==='\\'){i+=2;continue;}
        if(raw[i]==='(')depth++;
        if(raw[i]===')')depth--;
        i++;
      }
      if(depth!==0)reject();
      tokens.push({kind:'string',value:decodeString(raw.slice(start,i-1))});
    }else if(ch==='['||ch===']'){
      tokens.push({kind:ch});i++;
    }else if(ch==='/'){
      const start=++i;
      while(i<raw.length&&!delim(raw[i]))i++;
      const name=raw.slice(start,i);
      // Escaped names can disguise an operator or font identifier.
      if(!name||name.includes('#'))reject();
      tokens.push({kind:'name',value:name});
    }else if(')]{}<>'.includes(ch))reject();
    else{
      const start=i;
      while(i<raw.length&&!delim(raw[i]))i++;
      if(i===start)reject();
      const value=raw.slice(start,i);
      if(/[^!-~]/.test(value))reject();
      // BI/ID/EI are PDF inline-image delimiters; bytes between ID and EI
      // are image samples, not PDF instructions. Parsing them as words could
      // falsely "extract" a required text phrase from invisible pixel data.
      // Inline images are outside the supported text-only PDF subset.
      if(value==='BI'||value==='ID'||value==='EI')reject();
      tokens.push({kind:'word',value});
    }
    if(tokens.length>4096)reject();
  }
  return tokens;
}
const pdfNumber=/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;
function textFromStream(stream){
  let collected='',insideText=false,operands=[];
  for(const token of contentTokens(stream)){
    if(token.kind==='word'&&!pdfNumber.test(token.value)){
      const op=token.value;
      if(op==='BT'){
        if(insideText)reject();
        insideText=true;
      }else if(op==='ET'){
        if(!insideText)reject();
        insideText=false;
      }else if(op==='Tj'){
        if(!insideText||operands.length!==1||operands[0].kind!=='string')reject();
        collected+=operands[0].value+' ';
      }else if(op==='TJ'){
        if(!insideText||operands.length<3||
           operands[0].kind!=='['||operands.at(-1).kind!==']')reject();
        const entries=operands.slice(1,-1);
        if(entries.some(x=>x.kind!=='string'&&
           !(x.kind==='word'&&pdfNumber.test(x.value)))||
           !entries.some(x=>x.kind==='string'))reject();
        collected+=entries.filter(x=>x.kind==='string').map(x=>x.value).join('')+' ';
      }else if(op==="'"||op==='"'){
        // These text-showing operators require separate semantics.
        reject();
      }
      operands=[];
    }else{
      operands.push(token);
      if(operands.length>4096)reject();
    }
  }
  if(insideText||!collected.trim())reject();
  return collected.replace(/\s+/g,' ').trim();
}

// PDF ASCII85Decode (as used by ReportLab) with explicit output bound.
function decodeASCII85(bytes){
  const raw=bytes.toString('ascii').replace(/\s+/g,'');
  if(!raw.endsWith('~>'))reject();
  const data=raw.slice(0,-2),out=[];let group='';
  function emit(digits,length){
    let n=0;
    for(const d of digits)n=n*85+(d.charCodeAt(0)-33);
    if(n>0xffffffff||!Number.isSafeInteger(n))reject();
    out.push(...[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].slice(0,length));
    if(out.length>MAX_PDF_BYTES)reject();
  }
  for(const ch of data){
    if(ch==='z'){
      if(group)reject();
      out.push(0,0,0,0);
      if(out.length>MAX_PDF_BYTES)reject();
    }else{
      if(ch<'!'||ch>'u')reject();
      group+=ch;
      if(group.length===5){emit(group,4);group='';}
    }
  }
  if(group.length===1)reject();
  if(group.length>1)emit(group.padEnd(5,'u'),group.length-1);
  return Buffer.from(out);
}
function parsePDF(bytes){
  const raw=bytes.toString('latin1');
  if(!/^%PDF-1\.[0-7][\r\n]/.test(raw))reject();
  const marker=/startxref\s+(\d+)\s+%%EOF\s*$/.exec(raw);
  if(!marker||raw.indexOf('startxref')!==marker.index||
     raw.indexOf('%%EOF')!==raw.lastIndexOf('%%EOF'))reject();
  const xrefAt=Number(marker[1]);
  if(!Number.isSafeInteger(xrefAt)||xrefAt<9||xrefAt>=marker.index)reject();
  const xref=/^xref\s*\r?\n([\s\S]*?)trailer\s*<<([\s\S]*?)>>\s*$/.exec(
    raw.slice(xrefAt,marker.index));
  if(!xref||/\/(?:Encrypt|Prev|XRefStm)\b/.test(xref[2]))reject();
  const root=ref(xref[2],'Root');
  const size=Number(/\/Size\s+(\d+)\b/.exec(xref[2])?.[1]);
  if(!Number.isSafeInteger(size)||size<3||size>256)reject();
  const lines=xref[1].trim().split(/\r?\n/);
  const positions=new Map();
  for(let i=0;i<lines.length;){
    const range=/^(\d+)\s+(\d+)\s*$/.exec(lines[i++]);
    if(!range)reject();
    const first=Number(range[1]),count=Number(range[2]);
    if(count<1||first+count>size||i+count>lines.length)reject();
    for(let j=0;j<count;j++){
      const entry=/^(\d{10})\s+(\d{5})\s+([nf])\s*$/.exec(lines[i++]);
      if(!entry)reject();
      const objectId=first+j;
      if(entry[3]==='n'){
        const off=Number(entry[1]);
        if(entry[2]!=='00000'||off<9||off>=xrefAt||positions.has(objectId))reject();
        positions.set(objectId,off);
      }
    }
  }
  if(!positions.has(root)||positions.size>200)reject();
  const offsets=[...positions.values()].sort((a,b)=>a-b);
  if(new Set(offsets).size!==offsets.length)reject();
  const objects=new Map();
  for(const [id,offset] of positions){
    const end=offsets.find(pos=>pos>offset)??xrefAt;
    const source=raw.slice(offset,end).trimEnd();
    const object=new RegExp('^'+id+'\\s+0\\s+obj\\b([\\s\\S]*?)\\bendobj\\s*$').exec(source);
    if(!object)reject();
    objects.set(id,object[1]);
  }
  // PDF names permit #hh escapes (e.g. /Open#41ction). This restricted
  // validator rejects *every* encoded name before literal security matching.
  // Do not scan binary stream bodies, whose compressed bytes are not PDF names.
  for(const body of objects.values()){
    const streamStart=body.search(/\bstream\r?\n/);
    const dictionary=streamStart===-1?body:body.slice(0,streamStart);
    for(const match of dictionary.matchAll(/\/([^\s\/<>\[\]()%]+)/g))
      if(match[1].includes('#'))reject();
  }
  const get=id=>{if(!objects.has(id))reject();return objects.get(id);};
  const catalog=get(root);
  if(!/\/Type\s*\/Catalog\b/.test(catalog)||/\/(?:OpenAction|AA|AcroForm|Names)\b/.test(catalog))reject();
  const pagesRoot=ref(catalog,'Pages');
  const visited=new Set();
  const pageIds=[];
  function walk(id,depth,parent=null){
    if(depth>8||visited.has(id))reject();
    visited.add(id);
    const obj=get(id);
    // A page-tree node must name its actual referring parent. The root has none.
    if(parent===null){if(/\/Parent\b/.test(obj))reject();}
    else if(ref(obj,'Parent')!==parent)reject();
    if(/\/Type\s*\/Pages\b/.test(obj)){
      const kids=/\/Kids\s*\[([^\]]+)\]/.exec(obj);
      const expected=Number(/\/Count\s+(\d+)\b/.exec(obj)?.[1]);
      if(!kids||!Number.isSafeInteger(expected)||expected<1||expected>20)reject();
      const refs=[...kids[1].matchAll(/(\d+)\s+0\s+R\b/g)].map(x=>Number(x[1]));
      if(!refs.length||refs.length>20||kids[1].replace(/\d+\s+0\s+R\b/g,'').trim())reject();
      let count=0;for(const child of refs)count+=walk(child,depth+1,id);
      if(count!==expected)reject();
      return count;
    }
    if(!/\/Type\s*\/Page\b(?!s)/.test(obj))reject();
    pageIds.push(id);
    return 1;
  }
  walk(pagesRoot,0);
  if(pageIds.length<1||pageIds.length>20||
     [...objects.values()].filter(s=>/\/Type\s*\/Page\b(?!s)/.test(s)).length!==pageIds.length)reject();
  // Refuse unsupported interactive/embedded/encrypted/object-stream constructs.
  if([...objects.values()].some(s=>/\/(?:ObjStm|Encrypt|JavaScript|JS|Action|Launch|EmbeddedFiles|EmbeddedFile|XFA|Annots|AcroForm|OpenAction|AA|URI|RichMedia|SubmitForm|GoToR|ImportData)\b/.test(s)))reject();
  let combined='';
  const perPageText=[];
  for(const id of pageIds){
    const page=get(id);
    const contents=/\/Contents\s*(\[[^\]]+\]|\d+\s+0\s+R\b)/.exec(page);
    if(!contents)reject();
    const contentIds=[...contents[1].matchAll(/(\d+)\s+0\s+R\b/g)].map(x=>Number(x[1]));
    if(!contentIds.length||contentIds.length>8||
       contents[1].replace(/\d+\s+0\s+R\b/g,'').replace(/[\[\]\s]/g,'')!=='')reject();
    let pageText='';
    for(const streamId of contentIds){
      const obj=get(streamId),begin=/stream\r?\n/.exec(obj);
      const length=Number(/\/Length\s+(\d+)\b/.exec(obj)?.[1]);
      if(!begin||!Number.isSafeInteger(length)||length<1||length>MAX_PDF_BYTES)reject();
      const start=begin.index+begin[0].length;
      const streamBytes=Buffer.from(obj.slice(start,start+length),'latin1');
      if(streamBytes.length!==length||!/^(?:\r?\n)?endstream\s*$/.test(obj.slice(start+length)))reject();
      const header=obj.slice(0,begin.index);
      const filter=/\/Filter\s*(\[[^\]]{1,80}\]|\/[A-Za-z0-9]+)/.exec(header)?.[1];
      let decoded=streamBytes;
      if(/\/Filter\b/.test(header)&&!filter)reject();
      if(filter){
        if(/^\/FlateDecode$/.test(filter))
          decoded=inflateSync(streamBytes,{maxOutputLength:MAX_TEXT_BYTES});
        else if(/^\[\s*\/ASCII85Decode\s+\/FlateDecode\s*\]$/.test(filter))
          decoded=inflateSync(decodeASCII85(streamBytes),{maxOutputLength:MAX_TEXT_BYTES});
        else reject();
      }
      if(decoded.length>MAX_TEXT_BYTES)reject();
      pageText+=' '+textFromStream(decoded);
    }
    if(!pageText.trim())reject();
    perPageText.push(pageText.replace(/\s+/g,' ').trim());
    combined+=' '+pageText;
  }
  if(Buffer.byteLength(combined)>MAX_TEXT_BYTES)reject();
  return {pageCount:pageIds.length,text:combined.replace(/\s+/g,' ').trim(),perPageText};
}
/**
 * Operator grant AND per-call explicit declaration required. Never returns the
 * source PDF or its extracted text; only mechanical results and a content hash.
 */
export function validatePdfArtifact(inputs,{enabled=false}={}){
  if(!enabled||!isObject(inputs)||
     Object.keys(inputs).some(k=>!['authorization','format','dataBase64','mustContain'].includes(k))||
     inputs.authorization!=='validate_supplied_bytes_only'||inputs.format!=='application/pdf'||
     typeof inputs.dataBase64!=='string'||!inputs.dataBase64||
     inputs.dataBase64.length>Math.ceil(MAX_PDF_BYTES/3)*4||
     !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(inputs.dataBase64)||
     !Array.isArray(inputs.mustContain)||inputs.mustContain.length>8||
     inputs.mustContain.some(s=>typeof s!=='string'||s.length<1||s.length>80||
       !/^[\x20-\x7e]+$/.test(s)))reject();
  const bytes=Buffer.from(inputs.dataBase64,'base64');
  if(!bytes.length||bytes.length>MAX_PDF_BYTES||
     bytes.toString('base64')!==inputs.dataBase64)reject();
  const {pageCount,text,perPageText}=parsePDF(bytes);
  // A phrase must occur within one page: concatenating page streams would
  // otherwise satisfy a check whose words never occur together in the PDF.
  const matches=inputs.mustContain.map(needle=>perPageText.some(page=>page.includes(needle)));
  if(matches.some(x=>!x))reject(); // A required mechanical check must fail closed.
  return Object.freeze({format:'application/pdf',byteLength:bytes.length,
    sha256:createHash('sha256').update(bytes).digest('hex'),
    pageCount,extractableCharacters:text.length,
    requiredChecks:matches.length,matchedChecks:matches.filter(Boolean).length,
    mechanicalOnly:true});
}
