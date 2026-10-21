import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { mayAccept } from '../pilots/software/decision-gate.mjs';
import { initializeProject, loadProject, addTask, startTask, recordEvidence, closeTask, selectNext, saveState, validateProject } from '../src/core.mjs';
import { runDomainCheck } from '../src/adapters.mjs';

const rootDir = new URL('../', import.meta.url);
const sample = async path => readFile(new URL(path, rootDir), 'utf8');
const actor='pilot-implementer', reviewer='pilot-review-simulation';

async function proof({ root, state, task, kind, content, fileName }) {
  const path = fileName || kind + '-evidence.txt';
  await writeFile(join(root,path),content);
  return recordEvidence(root,state,{id:task.id,kind,file:path,
    actor:kind==='review'?reviewer:actor,
    note:kind==='review'
      ? 'Simulated separate role to exercise the state machine; NOT independently authenticated'
      : 'Observed '+kind+' evidence for '+task.profile+' pilot'});
}

async function adapter({ root, state, task, file, content }) {
  await writeFile(join(root,file),content);
  return runDomainCheck({ root, state, id:task.id, actor, file });
}

test('PP-0003: reproducible software, sourced research, and document lifecycles', async t => {
  const root=await mkdtemp(join(tmpdir(),'pp-pilots-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await initializeProject(root,'Cross-domain pilot project');
  const {state,profiles}=await loadProject(root);
  const software=addTask(state,profiles,{title:'Boolean review gate',objective:'Test a pure software decision utility',profile:'software',acceptance:['Eight truth-table cases and invalid inputs checked']});
  const research=addTask(state,profiles,{title:'Adapter limits',objective:'Verify sourced claims from project primary documents',profile:'research',acceptance:['Each claim checked against primary source text'],dependsOn:[software.id]});
  const document=addTask(state,profiles,{title:'Adapter guidance',objective:'Write and validate a usable handoff document',profile:'document',acceptance:['Mechanics, limitations and workflow explained'],dependsOn:[research.id]});
  assert.equal(selectNext(state).id,software.id);
  assert.throws(()=>startTask(state,research.id,actor),/dependencies/);
  const metrics=[];
  {
    const started=performance.now();
    startTask(state,software.id,actor);
    const invalid=await adapter({root,state,task:software,file:'decision-gate.mjs',content:'export const = ;'});
    assert.equal(invalid.report.result,'fail');
    const source=await sample('pilots/software/decision-gate.mjs');
    const valid=await adapter({root,state,task:software,file:'decision-gate.mjs',content:source});
    assert.equal(valid.report.result,'pass');
    assert.equal(valid.proof.kind,'adapter');
    let checked=0;
    for(const approved of [false,true])for(const currentHead of [false,true])for(const outstandingChanges of [false,true]){
      assert.equal(mayAccept({approved,currentHead,outstandingChanges}),approved&&currentHead&&!outstandingChanges);
      checked++;
    }
    assert.throws(()=>mayAccept({approved:'yes',currentHead:true,outstandingChanges:false}),TypeError);
    await recordEvidence(root,state,{id:software.id,kind:'artifact',file:'decision-gate.mjs',actor,note:'Imported and executed pure decision utility'});
    await proof({root,state,task:software,kind:'test',content:JSON.stringify({truthTableCases:checked,invalidInputRejected:true,adapterSyntaxPass:true},null,2)});
    await proof({root,state,task:software,kind:'validation',content:'The utility accepts only true approval + current head + no outstanding objections. Eight truth-table inputs and one invalid type checked.'});
    await assert.rejects(closeTask(root,state,profiles,software.id),/missing required evidence/);
    await proof({root,state,task:software,kind:'review',content:'SIMULATED reviewer role; lifecycle separation only, not genuine independent review.'});
    await closeTask(root,state,profiles,software.id);
    metrics.push({profile:'software',adapterAttempts:2,failedAdapterAttempts:1,reworks:1,runtimeAssertions:9,requiredEvidence:['artifact','test','validation','review','adapter'],closed:true,elapsedMs:Math.round(performance.now()-started)});
  }
  assert.equal(selectNext(state).id,research.id);
  {
    const started=performance.now();
    startTask(state,research.id,actor);
    const sourceText=await sample('pilots/research/adapter-capability-audit.json');
    const data=JSON.parse(sourceText);
    const corrupted={...data,claims:data.claims.map((claim,i)=>i===0?{...claim,sourceIds:['not-a-real-source']}:claim)};
    const bad=await adapter({root,state,task:research,file:'adapter-capability-audit.json',content:JSON.stringify(corrupted)});
    assert.equal(bad.report.result,'fail');
    const valid=await adapter({root,state,task:research,file:'adapter-capability-audit.json',content:sourceText});
    assert.equal(valid.report.result,'pass');
    const docs=await sample('docs/ADAPTERS.md');
    const security=await sample('docs/SECURITY.md');
    // A substantive local source audit, not just the citation-format adapter:
    assert.ok(docs.includes('no source script execution'));
    assert.ok(docs.includes('Research citations are not fetched or fact-checked'));
    assert.ok(docs.includes('Adapter output does **not** supply'));
    assert.ok(security.includes('Evidence:')||security.includes('**Evidence:**'));
    assert.equal(data.sources.length,2);
    assert.equal(data.claims.length,3);
    for(const claim of data.claims){
      assert.ok(claim.sourceIds.length>0);
      for(const id of claim.sourceIds) assert.ok(data.sources.some(source=>source.id===id));
    }
    await recordEvidence(root,state,{id:research.id,kind:'artifact',file:'adapter-capability-audit.json',actor,note:'Structured primary-source research artifact and claim references'});
    await proof({root,state,task:research,kind:'sources',content:JSON.stringify({auditedSources:data.sources.map(s=>s.url),verifiedClaims:data.claims.length,verifiedAgainstCheckedOutDocs:true,noNetworkFetchClaimed:true},null,2)});
    await proof({root,state,task:research,kind:'validation',content:'Audited three concrete claims against local checked-out primary docs, not merely source-ID structure.'});
    await proof({root,state,task:research,kind:'review',content:'SIMULATED reviewer role; no claim of human/independent provider review.'});
    await closeTask(root,state,profiles,research.id);
    metrics.push({profile:'research',adapterAttempts:2,failedAdapterAttempts:1,reworks:1,sourceDocuments:2,checkedClaims:3,requiredEvidence:['artifact','sources','validation','review','adapter'],closed:true,elapsedMs:Math.round(performance.now()-started)});
  }
  assert.equal(selectNext(state).id,document.id);
  {
    const started=performance.now();
    startTask(state,document.id,actor);
    const source=await sample('pilots/document/adapter-evidence-guide.md');
    const bad=await adapter({root,state,task:document,file:'adapter-evidence-guide.md',content:source+'\nTODO: unfinished content\n'});
    assert.equal(bad.report.result,'fail');
    const valid=await adapter({root,state,task:document,file:'adapter-evidence-guide.md',content:source});
    assert.equal(valid.report.result,'pass');
    assert.ok(source.includes('runtime tests'));
    assert.ok(source.includes('source audit'));
    assert.ok(source.includes('substantive content validation'));
    assert.ok(source.includes('not provider-authenticated'));
    await recordEvidence(root,state,{id:document.id,kind:'artifact',file:'adapter-evidence-guide.md',actor,note:'Readable handoff artifact'});
    await proof({root,state,task:document,kind:'validation',content:'Checked handoff guidance addresses software runtime tests, source audits, document content review, and reviewer identity boundary.'});
    await proof({root,state,task:document,kind:'review',content:'SIMULATED reviewer role; not a substitute for an authenticated independent critique.'});
    await closeTask(root,state,profiles,document.id);
    metrics.push({profile:'document',adapterAttempts:2,failedAdapterAttempts:1,reworks:1,reviewedContentRequirements:4,requiredEvidence:['artifact','validation','review','adapter'],closed:true,elapsedMs:Math.round(performance.now()-started)});
  }
  assert.equal(selectNext(state),null);
  validateProject(state,profiles);
  await saveState(root,state,profiles);
  const roundtrip=await loadProject(root);
  assert.deepEqual(roundtrip.state.tasks.map(task=>task.status),['verified','verified','verified']);
  for(const task of roundtrip.state.tasks)assert.equal(task.evidence.filter(p=>p.kind==='adapter').length,2);
  assert.equal(metrics.reduce((sum,p)=>sum+p.failedAdapterAttempts,0),3);
  // Parseable evidence in CI job logs, with runtime rather than invented timings.
  console.log('PP0003_PILOT_REPORT '+JSON.stringify({pilots:metrics,completed:3,adapterFailuresRecovered:3,sourceAuditClaims:3,sourceAuditDocuments:2,limitations:['Adapter checks are structural','Review identities in pilot fixtures are simulated, not independently authenticated','Source texts are checked-out primary documentation, not fetched from network','Runtime duration is environment-dependent']}));
});
