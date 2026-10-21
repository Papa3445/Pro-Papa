import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { mayAccept } from '../pilots/software/decision-gate.mjs';
import { auditResearchClaims, auditDocumentGuide } from '../pilots/validation/content-audits.mjs';
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
    const sources={
      'adapter-docs':await sample('docs/ADAPTERS.md'),
      'security-docs':await sample('docs/SECURITY.md'),
    };
    let attempts=0,failures=0,semanticRejects=0;
    const checked=async content=>{
      const output=await adapter({root,state,task:research,file:'adapter-capability-audit.json',content});
      attempts++;
      if(output.report.result==='fail')failures++;
      return output;
    };
    const corrupted={...data,claims:data.claims.map((claim,i)=>i===0?{...claim,sourceIds:['not-a-real-source']}:claim)};
    assert.equal((await checked(JSON.stringify(corrupted))).report.result,'fail');
    // Structural adapter accepts this plausible-looking but explicitly FALSE
    // claim: it still points to a real source ID. The substantive audit must reject.
    const falseClaim={...data,claims:data.claims.map((claim,i)=>i===0
      ? {...claim,text:'Pro-Papa software adapter executes untrusted scripts as root; this is guaranteed.'}
      : claim)};
    assert.equal((await checked(JSON.stringify(falseClaim))).report.result,'pass');
    assert.throws(()=>auditResearchClaims(falseClaim,sources),/Unsupported or contradictory research claim/);
    semanticRejects++;
    const valid=await checked(sourceText);
    assert.equal(valid.report.result,'pass');
    const audit=auditResearchClaims(data,sources);
    assert.equal(audit.auditedClaims.length,data.claims.length);
    assert.equal(audit.sourceCount,data.sources.length);
    for(const claim of audit.auditedClaims)
      assert.ok(claim.citations.every(citation=>citation.matchedExcerpts.length>0));
    await recordEvidence(root,state,{id:research.id,kind:'artifact',file:'adapter-capability-audit.json',actor,note:'Structured primary-source research artifact and claim references'});
    await proof({root,state,task:research,kind:'sources',content:JSON.stringify(audit,null,2)});
    await proof({root,state,task:research,kind:'validation',content:'Validated the exact three propositions and source-specific quoted excerpts against checked-out pinned project docs. A false claim with legitimate citation IDs passed the adapter but failed the substantive audit.'});
    await proof({root,state,task:research,kind:'review',content:'SIMULATED reviewer role; no claim of human/independent provider review.'});
    await closeTask(root,state,profiles,research.id);
    metrics.push({profile:'research',adapterAttempts:attempts,failedAdapterAttempts:failures,
      semanticAuditRejects:semanticRejects,reworks:attempts-1,
      sourceDocuments:audit.sourceCount,checkedClaims:audit.auditedClaims.length,
      requiredEvidence:['artifact','sources','validation','review','adapter'],
      closed:true,elapsedMs:Math.round(performance.now()-started)});
  }
  assert.equal(selectNext(state).id,document.id);
  {
    const started=performance.now();
    startTask(state,document.id,actor);
    const source=await sample('pilots/document/adapter-evidence-guide.md');
    let attempts=0,failures=0,semanticRejects=0;
    const checked=async content=>{
      const output=await adapter({root,state,task:document,file:'adapter-evidence-guide.md',content});
      attempts++;
      if(output.report.result==='fail')failures++;
      return output;
    };
    assert.equal((await checked(source+'\nTODO: unfinished content\n')).report.result,'fail');
    const contradictory=source.replace(
      'For software, these checks cover syntax rather than runtime behavior.',
      'For software, these checks guarantee runtime behavior, not merely syntax.');
    assert.notEqual(contradictory,source);
    // It still has a title, multiple sections, enough words and no TODO.
    assert.equal((await checked(contradictory)).report.result,'pass');
    assert.throws(()=>auditDocumentGuide(contradictory),/Incorrect, contradictory or unsupported guidance/);
    semanticRejects++;
    const misleading=source+'\n## Bonus guidance\nruntime tests; source audit; substantive content validation; not provider-authenticated.\n';
    assert.throws(()=>auditDocumentGuide(misleading),/exactly three audited sections/);
    semanticRejects++;
    const valid=await checked(source);
    assert.equal(valid.report.result,'pass');
    const reviewed=auditDocumentGuide(source);
    assert.equal(reviewed.validatedSections,3);
    await recordEvidence(root,state,{id:document.id,kind:'artifact',file:'adapter-evidence-guide.md',actor,note:'Readable handoff artifact'});
    await proof({root,state,task:document,kind:'validation',content:JSON.stringify({
      ...reviewed,negativeScenarios:['contradictory runtime guarantee rejected despite passing structural adapter',
        'extra keyword-padding section rejected by the editorial rubric'],
    },null,2)});
    await proof({root,state,task:document,kind:'review',content:'SIMULATED reviewer role; not a substitute for an authenticated independent critique.'});
    await closeTask(root,state,profiles,document.id);
    metrics.push({profile:'document',adapterAttempts:attempts,
      failedAdapterAttempts:failures,semanticAuditRejects:semanticRejects,
      reworks:attempts-1,reviewedContentRequirements:reviewed.validatedSections,
      requiredEvidence:['artifact','validation','review','adapter'],
      closed:true,elapsedMs:Math.round(performance.now()-started)});
  }
  assert.equal(selectNext(state),null);
  validateProject(state,profiles);
  await saveState(root,state,profiles);
  const roundtrip=await loadProject(root);
  assert.deepEqual(roundtrip.state.tasks.map(task=>task.status),['verified','verified','verified']);
  for(const task of roundtrip.state.tasks){
    const expected=task.profile==='software'?2:3; // one extra structural PASS with semantic FAIL
    assert.equal(task.evidence.filter(p=>p.kind==='adapter').length,expected);
  }
  assert.equal(metrics.reduce((sum,p)=>sum+p.failedAdapterAttempts,0),3);
  assert.equal(metrics.reduce((sum,p)=>sum+(p.semanticAuditRejects||0),0),3);
  // Parseable evidence in CI job logs, with runtime rather than invented timings.
  console.log('PP0003_PILOT_REPORT '+JSON.stringify({pilots:metrics,completed:metrics.filter(p=>p.closed).length,adapterFailuresRecovered:metrics.reduce((n,p)=>n+p.failedAdapterAttempts,0),semanticAuditRejects:metrics.reduce((n,p)=>n+(p.semanticAuditRejects||0),0),sourceAuditClaims:metrics.find(p=>p.profile==='research').checkedClaims,sourceAuditDocuments:metrics.find(p=>p.profile==='research').sourceDocuments,limitations:['Adapter checks are structural','Research audit accepts only three fixed reviewed propositions with exact supporting excerpts, not arbitrary new claims','Document audit uses a curated complete-section rubric, not generic language comprehension','Review identities in pilot fixtures are simulated, not independently authenticated','Source texts are checked-out primary documentation, not fetched from network','Runtime duration is environment-dependent']}));
});
