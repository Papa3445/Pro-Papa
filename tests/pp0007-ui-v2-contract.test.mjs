// PP-0007 future-only preregistration checks; no historical grades or tool claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const fixtures=new URL('../fixtures/',import.meta.url);
const registered=new URL('pp0007-ui-v2-contract.json',fixtures);
const frozen=new URL('pp0007-paired-trial-collection-template.json',fixtures);
const parse=async url=>JSON.parse(await readFile(url,'utf8'));

test('original seven cases and original Git blob remain unchanged',async()=>{
 const bytes=await readFile(frozen), old=JSON.parse(bytes), spec=await parse(registered);
 const gitBlob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(gitBlob,'aa07d8296ab8c4ad492ec02863bd4203bb90ead4');
 assert.equal(spec.originalFixtureGitBlobSha,gitBlob);
 assert.equal(spec.status,'predeclared_not_executed');
 assert.deepEqual(spec.caseDefinitions.map(x=>[x.id,x.canonicalObjective,x.canonicalCapability,x.canonicalInputs]),
   old.trials.map(x=>[x.id,x.canonicalObjective,x.canonicalCapability,x.canonicalInputs]));
});

test('participant prompts are fully frozen and same for both website arms',async()=>{
 const spec=await parse(registered),original=await parse(frozen);
 assert.equal(spec.promptRendering.method,'UTF-8 exact pasted text, no role instructions and no trailing newline');
 assert.match(spec.promptRendering.operatorRequirement,/actual user-message text or provider export/);
 for(let i=0;i<original.trials.length;i++){
   const x=original.trials[i],p=spec.caseDefinitions[i];
   const expected=x.canonicalObjective+(x.canonicalInputs===null?'':'\nCanonical inputs (JSON): '+JSON.stringify(x.canonicalInputs));
   assert.equal(p.submittedPrompt,expected,x.id);
   assert.equal(p.submittedPrompt.endsWith('\n'),false,x.id);
 }
 assert.equal(spec.caseDefinitions.find(x=>x.id==='research').submittedPrompt,
   'Research repository metadata with a provider URL\nCanonical inputs (JSON): {"repository":"Papa3445/Pro-Papa"}');
 assert.equal(spec.caseDefinitions.find(x=>x.id==='data').submittedPrompt,
   'Calculate the total for [2, 3, 5]\nCanonical inputs (JSON): {"numbers":[2,3,5]}');
 assert.equal(spec.newConversationPerObservation,true);
});

test('21 prospective paired trials preassign the closest possible 11/10 first-arm balance',async()=>{
 const spec=await parse(registered);
 const ids=spec.caseDefinitions.map(x=>x.id);
 assert.deepEqual(Object.keys(spec.orderByCase),ids);
 assert.equal(spec.repetitionsPerCase,3);
 const counts={regular:0,project:0};
 for(const id of ids){
   const assignments=spec.orderByCase[id];
   assert.equal(assignments.length,3,id);
   for(const order of assignments){
     assert.equal(order.length,2,id);
     assert.deepEqual([...order].sort(),['project','regular'],id);
     counts[order[0]]++;
   }
 }
 assert.deepEqual(counts,{regular:11,project:10});
 assert.equal(counts.regular+counts.project,7*spec.repetitionsPerCase);
 assert.equal(spec.orderByRepetition,undefined,'no globally unbalanced order');
 assert.deepEqual(spec.orderBalance,{totalPairedRepetitions:21,regularFirst:11,projectFirst:10,
   allocationMethod:'First four frozen cases: R/P, P/R, R/P. Last three: P/R, R/P, P/R. Preassigned, not randomized; one-pair imbalance is minimal for an odd total.'});
});

test('third-rater adjudication and missing-evidence fail closed',async()=>{
 const {rubric,observationTemplate,measurementPolicy,limits}=await parse(registered);
 assert.equal(rubric.notRetrospective,true);
 assert.equal(rubric.graderCountTarget,2);
 assert.deepEqual(Object.keys(rubric.grades),['0','1','2','3']);
 assert.deepEqual(rubric.adjudication.allowedScores,[0,1,2,3]);
 assert.match(rubric.adjudication.twoRatersDisagree,/third independent.*median.*final grade must be null/i);
 assert.match(rubric.adjudication.missingRaterOrEvidence,/Mark final grade null/);
 assert.match(rubric.adjudication.missingSoftwareArchive,/grade 3 is prohibited/);
 assert.match(rubric.adjudication.aggregatePolicy,/Do not replace null with zero/);
 assert.match(rubric.adjudication.completionRule,/separately recorded as true\/false\/null/);
 assert.match(rubric.ambiguityPolicy,/clarification is appropriate/);
 for(const key of ['actualSubmittedPrompt','promptParityVerified','qualityGradeRater1','qualityGradeRater2',
   'qualityGradeRater3','adjudicatedGrade','missingEvidenceReason','sharedSoftwareTestsVerified',
   'toolGrantParityVerified','providerReportedTokens']){
   assert.equal(observationTemplate[key],null,key);
 }
 assert.ok(Object.values(observationTemplate).every(value=>value===null));
 assert.match(measurementPolicy.projectReceiptPolicy,/Mandatory GitHub read remains/);
 assert.match(measurementPolicy.actualToolTraceRequirement,/footer is an observation/);
 assert.equal(measurementPolicy.wallClockMs,null);
 assert.equal(measurementPolicy.providerTokenCount,null);
 assert.match(limits,/no ChatGPT runs/);
});
