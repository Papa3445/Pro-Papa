import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateProject,selectNext} from '../src/core.mjs';
import {pp0012RegistrationSnapshot,pp0012ScopeSnapshot,pp0007LedgerSnapshot} from './pp0008-historical-pin-helper.mjs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const state=pp0012RegistrationSnapshot(JSON.parse(read('.pro-papa/tasks.json'))), raw=Buffer.from(JSON.stringify(state,null,2)+'\n');
const specBytes=read('fixtures/pp0012-practical-acceptance-scope-proposal.json'), spec=JSON.parse(specBytes);
const original=pp0012ScopeSnapshot(state);
const get=(l,id)=>l.tasks.find(t=>t.id===id);

test('PP-0012 exact scope-only revision reconstructs original protected ledger, preserving every other task',()=>{
 assert.equal(blob(raw),'906ec8c106af421c51a0e8d99d5e81d849d98209');
 assert.equal(blob(specBytes),'f47fd94358e6f6a45bfc2a1dd4839a8bff9fce79');
 assert.equal(state.revision,94);
 assert.equal(original.revision,93);
 assert.equal(blob(Buffer.from(JSON.stringify(original,null,2)+'\n')),'9b1e4dba9d37fc0b440d23d5ae46c1ccaab95eff');
 assert.equal(state.tasks.length,13);
 assert.equal(state.tasks.filter(t=>t.status==='verified').length,11);
 assert.equal(get(state,'PP-0012').status,'pending');
 assert.equal(get(state,'PP-0013').status,'pending');
 assert.deepEqual(get(original,'PP-0012'),spec.originalTask);
 assert.deepEqual(get(state,'PP-0012'),spec.revisedTask);
 assert.equal(spec.originalTask.acceptance.length,8);
 const changes=Object.keys(spec.revisedTask).filter(k=>JSON.stringify(spec.revisedTask[k])!==JSON.stringify(spec.originalTask[k]));
 assert.deepEqual(changes,['title','objective','acceptance']);
 for(const t of state.tasks.filter(t=>t.id!=='PP-0012'))assert.deepEqual(t,get(original,t.id));
 assert.deepEqual(get(state,'PP-0012').evidence,[]);
 assert.equal(get(state,'PP-0012').owner,null);
 assert.equal(get(state,'PP-0012').verifiedAt,undefined);
 assert.equal(validateProject(state,JSON.parse(read('.pro-papa/profiles.json'))),true);
 assert.equal(selectNext(state)?.id,'PP-0012');
 assert.equal(pp0007LedgerSnapshot(state).canonicalBlob,'c5bdf86ff43c6b6dcfe54563d187d86218ae3571');
});

test('PP-0012 unchanged research fixtures, evidence identities and no fabricated observations or approvals',()=>{
 const f=spec.optionalResearch.originalSevenCaseFixture,v=spec.optionalResearch.prospectiveWebsiteContract;
 assert.equal(blob(read(f.path)),f.gitBlobSha);
 assert.equal(blob(read(v.path)),v.gitBlobSha);
 assert.equal(f.gitBlobSha,'aa07d8296ab8c4ad492ec02863bd4203bb90ead4');
 assert.equal(v.gitBlobSha,'610ad35c145944b0f41ceb8f4f07a363046d3272');
 const cases=JSON.parse(read(f.path)),contract=JSON.parse(read(v.path));
 assert.equal(cases.status,'not_collected');
 assert.equal(cases.trials.length,7);
 assert.ok(cases.trials.every(t=>t.baselineTrial===null&&t.hostTrial===null&&t.independentQualityAssessment===null));
 assert.equal(contract.status,'predeclared_not_executed');
 assert.equal(contract.caseDefinitions.length*contract.repetitionsPerCase*2,42);
 assert.equal(v.collectedObservations,0);
 assert.equal(spec.optionalResearch.requiredForRevisedMilestone,false);
 assert.equal(spec.optionalResearch.newTrialCount,0);
 for(const e of spec.reusedEvidence)assert.equal(blob(read(e.path)),e.gitBlobSha,e.path);
 assert.ok(Object.values(spec.unmeasured).every(v=>v===null));
 assert.equal(spec.operatorAcceptance.gitBlobSha,'f1c677e98af262615e309c80b990836d6cb50787');
 assert.equal(spec.operatorAcceptance.independentComparativeMeasurement,false);
 assert.equal(spec.boundaries.independentScopeApproval,'pending');
 for(const name of ['milestoneClosureAuthorized','mergeAuthorized','deployAuthorized','pp0013Changed','productionSecurityAssurance','netlifyInvoked'])assert.equal(spec.boundaries[name],false);
});

test('PP-0012 scope snapshot fails closed on status, security, evidence, scope and unrelated history changes',()=>{
 for(const change of [
   l=>{get(l,'PP-0012').status='verified';},
   l=>{get(l,'PP-0012').acceptance.pop();},
   l=>{get(l,'PP-0012').owner='unapproved';},
   l=>{get(l,'PP-0012').evidence.push({kind:'review',result:'pass'});},
   l=>{get(l,'PP-0013').acceptance.pop();},
   l=>{get(l,'PP-0011').verifiedAt='2026-11-01T00:00:00.000Z';},
   l=>{get(l,'PP-0007').evidence.pop();},
 ]){
   const tampered=structuredClone(state);change(tampered);
   assert.throws(()=>pp0012ScopeSnapshot(tampered),/Unknown ledger mutation: PP-0012/);
   assert.throws(()=>pp0007LedgerSnapshot(tampered),/Unknown ledger mutation: PP-0012/);
 }
 const fake=structuredClone(state);fake.revision=95;
 assert.throws(()=>pp0007LedgerSnapshot(fake),/Unknown ledger mutation/);
});
