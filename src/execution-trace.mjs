// PP-0007: host-local ordering evidence, not ChatGPT reasoning attestation.
import {createHash} from 'node:crypto';

const REGULAR=['request.accepted','audit.not_required','route.selected',
  'handler.started','handler.returned','output.validated','response.released'];
const AUDITED=['request.accepted','audit.confirmed','route.selected',
  'handler.started','handler.returned','output.validated','response.released'];
const valid=steps=>Array.isArray(steps)&&steps.length<=7&&
  steps.every(s=>typeof s==='string'&&/^[a-z.]+$/.test(s));
const sha=output=>createHash('sha256').update(JSON.stringify(output)).digest('hex');

// Denied/incomplete executions cannot acquire a released status or output from this module.
export function blockedExecutionTrace(steps=[]){
  const bounded=valid(steps)?steps:[];
  return {schemaVersion:1,state:'not_released',
    events:bounded.map((step,i)=>({sequence:i+1,step})),
    providerAuthenticated:false};
}

export function releaseExecutionTrace({steps,route,dispatched,result,audit,requiredAudit}){
  const expected=requiredAudit?AUDITED:REGULAR;
  if(!valid(steps)||steps.length!==expected.length-1||
     steps.some((s,i)=>s!==expected[i])||
     !result||result.status!=='completed'||
     !result.execution||result.capability!==route||
     result.suggestedRoute!==route||dispatched!==route||
     !result.execution.provenance||
     typeof result.execution.provenance.provider!=='string'||
     (requiredAudit && (audit?.status!=='confirmed'||
        !/^[0-9a-f]{40}$/.test(audit.receiptCommit??'')||
        !/^[0-9a-f]{40}$/.test(audit.sourceCommit??'')))||
     (!requiredAudit && audit?.status!=='not_requested'))throw Error('Host release trace gate rejected');
  const serialized=JSON.stringify(result.execution);
  if(typeof serialized!=='string'||Buffer.byteLength(serialized)>262144)
    throw Error('Host release trace gate rejected');
  const sequence=[...steps,'response.released'];
  return {
    schemaVersion:1,state:'released',events:sequence.map((step,i)=>({sequence:i+1,step})),
    route,dispatchedCapability:dispatched,auditRequired:requiredAudit,
    auditReceiptCommit:requiredAudit?audit.receiptCommit:null,
    provider:result.execution.provenance.provider,executionSha256:sha(result.execution),
    providerAuthenticated:false,scope:'single_explicit_reference_host_invocation'
  };
}

// Detect changed payloads and reordered labels in a returned host-local result.
// This is NOT a digital signature or an independent provider trace.
export function verifyReleasedExecution(result){
  try{
    const t=result?.trace;
    if(t?.schemaVersion!==1||t.state!=='released'||t.providerAuthenticated!==false||
       t.scope!=='single_explicit_reference_host_invocation'||
       result.status!=='completed'||!result.execution||
       t.route!==result.capability||t.route!==result.suggestedRoute||
       t.dispatchedCapability!==result.capability||
       t.provider!==result.execution.provenance?.provider||
       t.executionSha256!==sha(result.execution))return false;
    if(typeof t.auditRequired!=='boolean'||!Array.isArray(t.events))return false;
    const expected=t.auditRequired?AUDITED:REGULAR;
    if(t.events.length!==expected.length||
       t.events.some((e,i)=>e?.sequence!==i+1||e.step!==expected[i]||
         Object.keys(e).length!==2))return false;
    if(t.auditRequired){
      if(result.audit?.status!=='confirmed'||
         t.auditReceiptCommit!==result.audit?.receiptCommit)return false;
    }else if(t.auditReceiptCommit!==null||result.audit?.status!=='not_requested')return false;
    return true;
  }catch{return false;}
}
