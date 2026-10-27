import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const bytes=path=>readFileSync(new URL(path,root));
const blobSha=path=>{const b=bytes(path);return createHash('sha1').update('blob '+b.length+'\x00').update(b).digest('hex')};
const p=read('fixtures/pp0007-route-b-acceptance-proposal.json');
const ledger=read('.pro-papa/tasks.json'),task=ledger.tasks.find(x=>x.id==='PP-0007');
const oldLedger='c5470334097519f36c0a788bffc9a666db61abdf';
const futureLedger='17ed8276b56c35c965d6444ac95d84116ebe239b';
const applicationLedger='a28a48789714c1051482b7c3201aac4e9a8c0a69';
const scopeApplication=read('fixtures/pp0007-route-b-application-authorization.json');
const isApplication=blobSha('.pro-papa/tasks.json')===applicationLedger;
test('Route B proposal preserves original literal clauses/82-item evidence and rejects unknown canonical ledger mutations',()=>{
 assert.equal(p.kind,'proposed_task_acceptance_change_not_applied');
 assert.equal(p.source.commit,'39076ac85a6864dd007b9ed6c947389548878508');
 assert.equal(p.source.taskLedgerGitBlobSha,oldLedger);
 const sha=blobSha('.pro-papa/tasks.json');
 assert.ok([oldLedger,futureLedger,applicationLedger].includes(sha),'unexpected ledger must fail closed');
 assert.equal(ledger.revision,isApplication?74:sha===oldLedger?72:73);
 assert.equal(ledger.tasks.length,isApplication?12:sha===oldLedger?7:11);
 if(sha!==oldLedger)for(const future of ledger.tasks.slice(7,11)){
  assert.deepEqual(future.dependsOn,['PP-0007']);
  assert.equal(future.status,'pending');
 }
 assert.equal(task.status,'in_progress');
 assert.equal(task.evidence.length,p.source.originalTaskEvidenceCount);
 assert.equal(task.evidence.length,82);
 assert.deepEqual(task.reviewTarget,p.source.originalReviewTarget);
 assert.deepEqual(task.acceptance,isApplication?p.proposedTaskAfter.acceptance:p.taskBefore.acceptance);
 assert.equal(task.title,isApplication?p.proposedTaskAfter.title:p.taskBefore.title);
 assert.equal(task.objective,isApplication?p.proposedTaskAfter.objective:p.taskBefore.objective);
 if(isApplication){
  assert.equal(scopeApplication.candidateLedgerGitBlobSha,applicationLedger);
  assert.deepEqual(ledger.tasks.at(-1).acceptance.slice(0,4),p.taskBefore.acceptance);
  assert.deepEqual(ledger.tasks.at(-1).acceptance.slice(4),p.deferredOriginalObligations.proposalForDistinctFutureTask.candidateAcceptance);
 }
 assert.equal(p.deferredOriginalObligations.everyOriginalAcceptancePreserved.length,4);
 assert.deepEqual(p.deferredOriginalObligations.everyOriginalAcceptancePreserved,p.taskBefore.acceptance);
});
test('Route B proposes exactly four scoped new criteria with no acceptance/application/closeout by implication',()=>{
 assert.equal(p.proposedTaskAfter.acceptance.length,4);
 assert.ok(p.proposedTaskAfter.acceptance.every(x=>x.length>110));
 assert.notDeepEqual(p.proposedTaskAfter.acceptance,p.taskBefore.acceptance);
 assert.match(p.proposedTaskAfter.acceptance[0],/read-only OAuth MCP executions/);
 assert.match(p.proposedTaskAfter.acceptance[0],/separately from native ChatGPT-created artifacts/);
 assert.match(p.proposedTaskAfter.acceptance[1],/missing signed-JWT production adversarial coverage/);
 assert.match(p.proposedTaskAfter.acceptance[2],/missing human corrections, cost and tokens as null/);
 assert.match(p.proposedTaskAfter.acceptance[3],/Keep \`PP-0007\` open/);
 assert.equal(p.ownerSelection.approvedAction,'draft_for_independent_review');
 for(const k of ['appliedAuthorization','taskClosureAuthorized','mergeAuthorized','deployAuthorized'])
  assert.equal(p.ownerSelection[k],false,k);
 assert.equal(p.nextTransition.allowedTaskLedgerChangeNow,false);
 assert.equal(p.nextTransition.allowedEvidenceModificationNow,false);
 assert.equal(p.nextTransition.allowedStartPP0008Now,false);
 assert.equal(p.deferredOriginalObligations.status,'not_applied_or_created');
});
test('Route B separately preserves original broad benchmark as explicit proposed dependent future obligation',()=>{
 const future=p.deferredOriginalObligations.proposalForDistinctFutureTask;
 assert.equal(future.candidateId,'PP-0012');
 assert.equal(future.idReservedInCanonicalLedger,false);
 assert.equal(future.state,'proposal_only_not_created');
 assert.deepEqual(future.proposedDependsOn,['PP-0007','PP-0011']);
 assert.equal(ledger.tasks.some(x=>x.id==='PP-0012'),isApplication);
 assert.equal(future.candidateAcceptance.length,4);
 assert.match(future.candidateAcceptance[0],/seven frozen canonical case/);
 assert.match(future.candidateAcceptance[2],/comparable direct-assistant and Project outcome quality/);
 assert.match(future.candidateAcceptance[3],/independent grading\/review/);
 assert.equal(p.evidenceBoundary.originalSevenNoGrantCompleted,1);
 assert.equal(p.evidenceBoundary.originalSevenWithGrantCompleted,2);
 assert.equal(p.evidenceBoundary.separateStructuredMechanicalCompletions,4);
 assert.equal(p.evidenceBoundary.originalSevenComparableResponsesCollected,0);
 assert.equal(p.evidenceBoundary.prospectiveUiV2TrialsCollected,0);
 assert.equal(p.evidenceBoundary.prospectiveUiV2TrialsPlanned,42);
 assert.equal(p.evidenceBoundary.statisticalSuperiorityClaim,false);
 for(const name of ['matchedCorrections','matchedTokenUse','matchedTotalLatency'])
  assert.equal(p.evidenceBoundary[name],null,name);
});
test('Route B source-contract pins original fixtures and enforces redacted proposal-only boundaries',()=>{
 const currentAgents=bytes('AGENTS.md');
 const agentBoundary=Buffer.from('\n## Development throughput and loop prevention\n');
 const policyPos=currentAgents.indexOf(agentBoundary);
 if(policyPos!==-1){
  assert.equal(currentAgents.lastIndexOf(agentBoundary),policyPos,'do not duplicate historical appendix');
  assert.ok(currentAgents.subarray(policyPos).toString('utf8').includes('docs/DEVELOPMENT-DELIVERY.md'));
 }
 const historicalAgentBytes=policyPos===-1?currentAgents:currentAgents.subarray(0,policyPos+1);
 const historicalAgentSha=createHash('sha1').update('blob '+historicalAgentBytes.length+String.fromCharCode(0)).update(historicalAgentBytes).digest('hex');
 assert.equal(historicalAgentSha,p.source.agentContractBlob,'historical AGENTS source remains immutable');
 assert.equal(blobSha('.pro-papa/profiles.json'),p.source.profilesBlob);
 assert.equal(blobSha('fixtures/pp0007-paired-trial-collection-template.json'),p.source.canonicalSevenFixtureBlob);
 assert.equal(blobSha('fixtures/pp0007-ui-v2-contract.json'),p.source.uiV2FixtureBlob);
 const canonical=read('fixtures/pp0007-paired-trial-collection-template.json');
 assert.equal(canonical.status,'not_collected');
 assert.equal(canonical.trials.length,7);
 assert.ok(canonical.trials.every(t=>t.baselineTrial===null&&t.hostTrial===null));
 assert.equal(p.externalBlockers.find(x=>x.id==='main_protection').state,'unconfigured');
 assert.equal(p.externalBlockers.find(x=>x.id==='reviewed_netlify_fix_deployment').resolvedByThisProposal,false);
 assert.equal(p.evidenceBoundary.mcpAutomaticallyInterceptsAllChatgptMessages,false);
 assert.equal(p.evidenceBoundary.priorOriginalPdfBytesReinspectedHere,false);
});
