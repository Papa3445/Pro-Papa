import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {validatePdfArtifact} from '../src/artifact-validation.mjs';
import {createReferenceHost} from '../src/reference-host.mjs';
import {createReadOnlyMcpWebHandler} from '../src/mcp-web.mjs';
import {verifyReleasedExecution} from '../src/execution-trace.mjs';

// Actual self-contained classic PDF fixture: xref byte offsets, page tree,
// optional FlateDecode streams and real BT/Tj text. No private test document.
function pdfFixture({pages=['Native PDF validation works'],compressed=true,
  pageParent=2,pageExtra='',catalogExtra='',extraObject=null,contentExtra=''}={}){
  const objects=['',
    '<< /Type /Catalog /Pages 2 0 R '+catalogExtra+' >>',
    '<< /Type /Pages /Kids ['+pages.map((_,i)=>(3+i)+' 0 R').join(' ')+'] /Count '+pages.length+' >>'];
  for(let i=0;i<pages.length;i++){
    objects[3+i]='<< /Type /Page /Parent '+pageParent+' 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents '+
      (3+pages.length+i)+' 0 R '+pageExtra+' >>';
  }
  for(let i=0;i<pages.length;i++){
    const escaped=pages[i].replace(/[\\()]/g,s=>'\\'+s);
    const bytes=Buffer.from('BT /F1 12 Tf 72 700 Td ('+escaped+') Tj ET'+contentExtra,'ascii');
    const stream=compressed?deflateSync(bytes):bytes;
    objects[3+pages.length+i]='<< /Length '+stream.length+
      (compressed?' /Filter /FlateDecode':'')+' >>\nstream\n'+stream.toString('latin1')+
      '\nendstream';
  }
  if(extraObject!==null)objects.push(extraObject);
  let raw='%PDF-1.4\n';
  const offsets=[0];
  for(let i=1;i<objects.length;i++){
    offsets[i]=Buffer.byteLength(raw,'latin1');
    raw+=i+' 0 obj\n'+objects[i]+'\nendobj\n';
  }
  const xref=Buffer.byteLength(raw,'latin1');
  raw+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
  for(let i=1;i<objects.length;i++)raw+=String(offsets[i]).padStart(10,'0')+
    ' 00000 n \n';
  raw+='trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return Buffer.from(raw,'latin1');
}
const input=(pdf,checks=[])=>({
  authorization:'validate_supplied_bytes_only',format:'application/pdf',
  dataBase64:pdf.toString('base64'),mustContain:checks
});
const args=(inputs)=>({objective:'Mechanically verify provided PDF artifact',
  capability:'artifact.validate',inputs});
const HOST='pp0008-example.netlify.app';
const SECRET='pp0008-demo-test-secret-0123456789abcdef';
const mcpCall=inputs=>new Request('https://'+HOST+'/mcp',{
  method:'POST',headers:{Authorization:'Bearer '+SECRET,
    Accept:'application/json, text/event-stream','Content-Type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',
    params:{name:'pro_papa_execute_readonly',arguments:args(inputs)}})
});

test('PP-0008 parses actual two-page compressed PDF, returns only digest and mechanical metrics',()=>{
  const bytes=pdfFixture({pages:['Alpha verified','Beta checklist']});
  const out=validatePdfArtifact(input(bytes,['Alpha','Beta']),{enabled:true});
  assert.equal(out.pageCount,2);
  assert.equal(out.requiredChecks,2);
  assert.equal(out.matchedChecks,2);
  assert.equal(out.mechanicalOnly,true);
  assert.equal(out.sha256.length,64);
  assert.equal(out.byteLength,bytes.length);
  assert.equal(JSON.stringify(out).includes('Alpha'),false);
  assert.equal(JSON.stringify(out).includes('Beta'),false);
});
test('PP-0008 default denies even valid data without operator grant',()=>{
  assert.throws(()=>validatePdfArtifact(input(pdfFixture())),/denied/);
});
test('PP-0008 rejects malformed, contradictory and dangerous PDFs and tampered checks',()=>{
  const good=pdfFixture({compressed:false});
  const broken=Buffer.from(good);broken[broken.length-7]=88;
  const probes=[
    {...input(good),authorization:'skip_auth'},
    {...input(good),format:'text/plain'},
    {...input(good),mustContain:['missing']},
    {...input(good),mustContain:['a'.repeat(81)]},
    {...input(good),dataBase64:'Zm9v='},
    {...input(good),extraSecret:'unsafe'},
    {...input(good),dataBase64:'A'.repeat(50000)},
    {...input(good),mustContain:['Native'],dataBase64:broken.toString('base64')},
    input(Buffer.from('%PDF-1.4\n/Encrypt 1 0 R\n%%EOF')),
    input(Buffer.concat([good,Buffer.from('%%EOF')])),
    input(Buffer.from('not a PDF')),
  ];
  for(const probe of probes)assert.throws(()=>validatePdfArtifact(probe,{enabled:true}),
    /denied/,JSON.stringify(Object.keys(probe)));
});
test('PP-0008 rejects malformed tree links, interactive annotations, and cross-page false matches',async()=>{
  const mismatchedParent=pdfFixture({pageParent:1});
  const annotation=pdfFixture({pageExtra:'/Annots []'});
  const extraAction=pdfFixture({pageExtra:'/OpenAction 10 0 R'});
  const separatePages=pdfFixture({pages:['Alpha','Beta']});
  for(const pdf of [mismatchedParent,annotation,extraAction]){
    assert.throws(()=>validatePdfArtifact(input(pdf,['Native']),{enabled:true}),/denied/);
  }
  assert.throws(()=>validatePdfArtifact(input(separatePages,['Alpha Beta']),
    {enabled:true}),/denied/);
  // Both independently extractable page-local values remain valid.
  assert.equal(validatePdfArtifact(input(separatePages,['Alpha','Beta']),
    {enabled:true}).matchedChecks,2);
  const host=createReferenceHost({artifactValidationEnabled:true,traceMode:'enforced'});
  const denied=await host.execute(args(input(separatePages,['Alpha Beta'])));
  assert.notEqual(denied.status,'completed');
  assert.equal(denied.trace.state,'not_released');
  assert.equal(denied.execution,null);
});

test('PP-0008 ignores PDF comment text and denies encoded action names across MCP',async()=>{
  // Real classic-xref byte fixtures. The only drawn text is "Visible statement".
  const onlyComment=pdfFixture({pages:['Visible statement'],compressed:false,
    contentExtra:'\n% BT /F1 12 Tf (Ghost required phrase) Tj ET\n'});
  const escapedAction=pdfFixture({pages:['Visible statement'],
    catalogExtra:'/Open#41ction 5 0 R',
    extraObject:'<< /Type /Action /S /Java#53cript /J#53 (ignored) >>'});
  const escapedPage=pdfFixture({pages:['Visible statement'],
    pageExtra:'/AA << /O << /S /Java#53cript >> >>'});
  assert.equal(validatePdfArtifact(input(onlyComment,['Visible statement']),
    {enabled:true}).matchedChecks,1);
  assert.throws(()=>validatePdfArtifact(input(onlyComment,['Ghost required phrase']),
    {enabled:true}),/denied/);
  for(const pdf of [escapedAction,escapedPage]){
    assert.throws(()=>validatePdfArtifact(input(pdf,['Visible statement']),
      {enabled:true}),/denied/);
  }
  const host=createReferenceHost({artifactValidationEnabled:true,traceMode:'enforced'});
  const negative=await host.execute(args(input(onlyComment,['Ghost required phrase'])));
  assert.equal(negative.trace.state,'not_released');
  assert.equal(negative.execution,null);
  const app=createReadOnlyMcpWebHandler({bearerToken:SECRET,hostname:HOST,
    artifactValidationEnabled:true});
  for(const [pdf,required] of [[onlyComment,'Ghost required phrase'],
                                [escapedAction,'Visible statement']]){
    const result=await (await app(mcpCall(input(pdf,[required])))).json();
    assert.equal(result.result.isError,true);
    assert.equal(result.result.structuredContent,undefined);
    assert.equal(JSON.stringify(result).includes('Ghost required phrase'),false);
    assert.equal(JSON.stringify(result).includes('Visible statement'),false);
  }
});

test('PP-0008 host release validates authorized bytes and rejects missing checks',async()=>{
  const bytes=pdfFixture();
  const host=createReferenceHost({artifactValidationEnabled:true,traceMode:'enforced'});
  const ok=await host.execute(args(input(bytes,['Native PDF'])));
  assert.equal(ok.status,'completed');
  assert.equal(ok.execution.output.pageCount,1);
  assert.equal(ok.execution.provenance.operation,'artifact.validate');
  assert.equal(verifyReleasedExecution(ok),true);
  const bad=await host.execute(args(input(bytes,['Incorrect'])));
  assert.notEqual(bad.status,'completed');
  assert.equal(bad.execution,null);
  assert.equal(bad.trace.state,'not_released');
  const noGrant=await createReferenceHost({traceMode:'enforced'}).execute(
    args(input(bytes,['Native'])));
  assert.equal(noGrant.status,'denied');
  assert.equal(noGrant.trace.state,'not_released');
});
test('PP-0008 MCP HTTPS transport hides capability by default and releases only validated PDF',async()=>{
  const disabled=createReadOnlyMcpWebHandler({bearerToken:SECRET,hostname:HOST});
  const payload=input(pdfFixture(),['Native PDF']);
  const denied=await (await disabled(mcpCall(payload))).json();
  assert.equal(denied.error.code,-32602);
  const web=createReadOnlyMcpWebHandler({
    bearerToken:SECRET,hostname:HOST,artifactValidationEnabled:true
  });
  const good=await (await web(mcpCall(payload))).json();
  assert.equal(good.result.isError,false);
  assert.equal(verifyReleasedExecution(good.result.structuredContent),true);
  assert.equal(good.result.structuredContent.execution.output.pageCount,1);
  assert.equal(JSON.stringify(good).includes('Native PDF validation works'),false);
  const wrong=await (await web(mcpCall(input(pdfFixture(),['Does not exist'])))).json();
  assert.equal(wrong.result.isError,true);
  assert.equal(wrong.result.structuredContent,undefined);
  assert.equal(wrong.result.content[0].text.includes('Native PDF'),false);
});

test('PP-0008 separately validates actual ReportLab-created two-page PDF through MCP',async()=>{
  // Real ReportLab Canvas(invariant=1), not the hand-authored xref fixture above.
  // Synthetic public text; full bytes reproduce the document deterministically.
  const pdf=Buffer.from('JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDggMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCA3IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9Db250ZW50cyA5IDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9QYXJlbnQgNyAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNSAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDcgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9BdXRob3IgKFByby1QYXBhIHN5bnRoZXRpYyBDSSBmaXh0dXJlKSAvQ3JlYXRpb25EYXRlIChEOjIwMDAwMTAxMDAwMDAwKzAwJzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMDAwMTAxMDAwMDAwKzAwJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKFBQLTAwMDggTmF0aXZlIEFydGlmYWN0IFZhbGlkYXRpb24gRml4dHVyZSkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago3IDAgb2JqCjw8Ci9Db3VudCAyIC9LaWRzIFsgMyAwIFIgNCAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjggMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMTIxCj4+CnN0cmVhbQpHYXBARF0rLikmJi1bRGYwZFIwTTc4T0BBYEBeY2dERUpQYDhwbkJEajxSWXRqc11kbzU3VGQpN2JUO1tANUY/IjNTKVlfbjlGb1wxOENjTmdCakRhT2MlJktiO0o3SU5sdUBha2cqdCVZU0UpUjA+UyoyQWYmSn4+ZW5kc3RyZWFtCmVuZG9iago5IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDExNQo+PgpzdHJlYW0KR2FwUWgwRT1GLDBVXEgzVFxwTllUXlFLaz90Yz5JUCw7VyNVMV4yM2loUEVNXz9DVzRLSVNpPDtEPkYyOl5HMENjajNCQGNIZi1cLXFJJC08Q2tEKzohUEBEYy4sYyFhXGlEbCFia1FqIVdfIy4oNDZ+PmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDEwCjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMDkyIDAwMDAwIG4gCjAwMDAwMDAxOTkgMDAwMDAgbiAKMDAwMDAwMDM5MiAwMDAwMCBuIAowMDAwMDAwNTg1IDAwMDAwIG4gCjAwMDAwMDA2NTMgMDAwMDAgbiAKMDAwMDAwMDk2OCAwMDAwMCBuIAowMDAwMDAxMDMzIDAwMDAwIG4gCjAwMDAwMDEyNDQgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8NGZiNDhiYTMxM2M0Yzc3NzE5N2RjMGZlMGY5MjVkY2E+PDRmYjQ4YmEzMTNjNGM3NzcxOTdkYzBmZTBmOTI1ZGNhPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA2IDAgUgovUm9vdCA1IDAgUgovU2l6ZSAxMAo+PgpzdGFydHhyZWYKMTQ0OQolJUVPRgo=','base64');
  assert.equal(pdf.length,1862);
  assert.equal(createHash('sha256').update(pdf).digest('hex'),
    '021193766742a4460a506df24ed07e95d4b5ccf6fa4cfe88af3e683195af7df9');
  const app=createReadOnlyMcpWebHandler({bearerToken:SECRET,hostname:HOST,
    artifactValidationEnabled:true});
  const response=await (await app(mcpCall(input(pdf,['PP0008 native PDF validated','Second page checksum'])))).json();
  assert.equal(response.result.isError,false);
  assert.equal(response.result.structuredContent.execution.output.pageCount,2);
  assert.equal(response.result.structuredContent.execution.output.matchedChecks,2);
  assert.equal(response.result.structuredContent.execution.output.sha256,
    '021193766742a4460a506df24ed07e95d4b5ccf6fa4cfe88af3e683195af7df9');
  assert.equal(verifyReleasedExecution(response.result.structuredContent),true);
  assert.equal(JSON.stringify(response).includes('Second page checksum'),false);
});
