import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {validatePdfArtifact} from '../src/artifact-validation.mjs';
import {createReferenceHost} from '../src/reference-host.mjs';
import {createReadOnlyMcpWebHandler} from '../src/mcp-web.mjs';
import {verifyReleasedExecution} from '../src/execution-trace.mjs';

// Actual self-contained classic PDF fixture: xref byte offsets, page tree,
// optional FlateDecode streams and real BT/Tj text. No private test document.
function pdfFixture({pages=['Native PDF validation works'],compressed=true}={}){
  const objects=['',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids ['+pages.map((_,i)=>(3+i)+' 0 R').join(' ')+'] /Count '+pages.length+' >>'];
  for(let i=0;i<pages.length;i++){
    objects[3+i]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents '+
      (3+pages.length+i)+' 0 R >>';
  }
  for(let i=0;i<pages.length;i++){
    const escaped=pages[i].replace(/[\\()]/g,s=>'\\'+s);
    const bytes=Buffer.from('BT /F1 12 Tf 72 700 Td ('+escaped+') Tj ET','ascii');
    const stream=compressed?deflateSync(bytes):bytes;
    objects[3+pages.length+i]='<< /Length '+stream.length+
      (compressed?' /Filter /FlateDecode':'')+' >>\nstream\n'+stream.toString('latin1')+
      '\nendstream';
  }
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
