// PP-0007 prospectively freezes criteria. This file never grades old screenshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root = new URL('../fixtures/', import.meta.url);
const planPath = new URL('pp0007-ui-v2-contract.json',root);
const originalPath = new URL('pp0007-paired-trial-collection-template.json',root);
const read = async path=>JSON.parse(await readFile(path,'utf8'));

test('prospective study preserves original seven benchmark inputs and original git blob',async()=>{
 const raw=await readFile(originalPath), old=JSON.parse(raw), a=await read(planPath);
 const gitBlob=createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
 assert.equal(gitBlob,'aa07d8296ab8c4ad492ec02863bd4203bb90ead4');
 assert.equal(a.originalFixtureGitBlobSha,gitBlob);
 assert.equal(a.status,'predeclared_not_executed');
 assert.deepEqual(a.caseDefinitions.map(x=>[x.id,x.canonicalObjective,x.canonicalCapability,x.canonicalInputs]),old.trials.map(x=>[x.id,x.canonicalObjective,x.canonicalCapability,x.canonicalInputs]));
});
test('future-only scoring and repeat scheme do not promote old observations',async()=>{
 const a=await read(planPath);
 assert.equal(a.rubric.notRetrospective,true);
 assert.equal(a.rubric.graderCountTarget,2);
 assert.deepEqual(Object.keys(a.rubric.grades),['0','1','2','3']);
 assert.equal(a.repetitionsPerCase,3);
 assert.deepEqual(a.orderByRepetition,[['regular','project'],['project','regular'],['regular','project']]);
 assert.equal(a.newConversationPerObservation,true);
 assert.match(a.rubric.ambiguityPolicy,/clarification is appropriate/);
 assert.equal(a.arms.length,2);
});
test('unknown metrics stay null, and per-message GitHub rule is never omitted',async()=>{
 const a=await read(planPath);
 assert.match(a.arms[1].setting,/mandatory per-message live GitHub access unchanged/);
 assert.match(a.measurementPolicy.projectReceiptPolicy,/Mandatory GitHub read remains/);
 assert.match(a.measurementPolicy.actualToolTraceRequirement,/footer is an observation/);
 assert.equal(a.measurementPolicy.wallClockMs,null);
 assert.equal(a.measurementPolicy.providerTokenCount,null);
 assert.equal(a.observationTemplate.providerAuthenticated,null);
 assert.equal(a.observationTemplate.taskComplete,null);
 assert.ok(Object.values(a.observationTemplate).every(x=>x===null));
 assert.match(a.limits,/no ChatGPT runs/);
});
