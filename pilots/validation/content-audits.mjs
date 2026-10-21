/**
 * Bounded, explicit acceptance oracles for PP-0003's fixed sample artifacts.
 * These validate specific approved propositions and complete document sections,
 * not general factual truth or arbitrary Markdown quality.
 */
const BASE='a72fa597494cadf54cb3c813f3bd9c6f5da39b23';
export const SOURCES=Object.freeze({
  'adapter-docs':{
    url:'https://github.com/Papa3445/Pro-Papa/blob/'+BASE+'/docs/ADAPTERS.md',
    path:'docs/ADAPTERS.md',
  },
  'security-docs':{
    url:'https://github.com/Papa3445/Pro-Papa/blob/'+BASE+'/docs/SECURITY.md',
    path:'docs/SECURITY.md',
  },
});
export const CLAIM_ORACLES=Object.freeze([
  {
    claim:'The software adapter checks syntax and does not execute source scripts.',
    supports:{
      'adapter-docs':['software |','syntax:node','no source script execution'],
    },
  },
  {
    claim:'The research adapter checks citation structure, not factual accuracy.',
    supports:{
      'adapter-docs':['citations:structure','Research citations are not fetched or fact-checked.'],
      'security-docs':['Citation and document checks are structural only.'],
    },
  },
  {
    claim:'A passing adapter report is not itself independent review.',
    supports:{
      'adapter-docs':['Adapter output does **not** supply','independent \`review\`'],
      'security-docs':['Manual proofs remain claims backed by hashed evidence files, not authenticated observations'],
    },
  },
]);
const check=(value,message)=>{if(!value)throw new Error(message)};
const norm=s=>s.replace(/\s+/g,' ').trim();

export function auditResearchClaims(artifact, sourceTexts) {
  check(artifact?.sources?.length===Object.keys(SOURCES).length,'Unexpected source count');
  for(const source of artifact.sources){
    const expected=SOURCES[source.id];
    check(expected && source.url===expected.url,'Source identity or pinned URL differs from approved source');
    check(typeof sourceTexts[source.id]==='string' && sourceTexts[source.id].length>0,
      'Pinned primary source contents unavailable');
  }
  check(artifact?.claims?.length===CLAIM_ORACLES.length,'Research claim set differs from reviewed scope');
  const auditedClaims=[];
  for(let i=0;i<CLAIM_ORACLES.length;i++){
    const actual=artifact.claims[i],rule=CLAIM_ORACLES[i];
    check(typeof actual?.text==='string' && norm(actual.text)===norm(rule.claim),
      'Unsupported or contradictory research claim '+(i+1));
    const ids=Object.keys(rule.supports);
    check(Array.isArray(actual.sourceIds) && actual.sourceIds.length===ids.length &&
      ids.every(id=>actual.sourceIds.includes(id)),
      'Claim '+(i+1)+' cites sources other than its audited supporting documents');
    const citations=[];
    for(const id of ids){
      const text=sourceTexts[id];
      for(const excerpt of rule.supports[id]){
        check(text.includes(excerpt),'Claim '+(i+1)+' missing supporting source excerpt in '+id);
      }
      citations.push({sourceId:id,sourcePath:SOURCES[id].path,matchedExcerpts:rule.supports[id]});
    }
    auditedClaims.push({text:actual.text,citations});
  }
  return {reviewedScope:'three fixed repository-specific claims; exact approved wording and supporting excerpts',
    auditedClaims,sourceCount:Object.keys(SOURCES).length};
}

// All the following sentences were reviewed as an explicit three-section editorial
// rubric: each statement has a defined placement and must be neither omitted nor
// contradicted by extra prose. Unrelated keyword padding and unapproved assertions
// fail. This is intentionally a narrow gold-standard sample, not an AI fact-checker.
export const DOCUMENT_RUBRIC=Object.freeze([
  {
    title:'What the result actually establishes',
    text:'A passing adapter report establishes only the bounded mechanical checks that the corresponding adapter performed. For software, these checks cover syntax rather than runtime behavior. For research, they cover source identifiers and structured citation references rather than the truth of those sources. For documents, they cover headings, prose length, and obvious placeholders.',
  },
  {
    title:'What still requires evidence',
    text:"A reviewer should inspect the task's actual acceptance criteria and make an independent judgment about usefulness and correctness. Software needs genuine runtime tests; research needs a source audit; and documents need substantive content validation. A hash verifies which bytes were recorded but does not establish that the evidence is truthful.",
  },
  {
    title:'Recommended handoff',
    text:'Attach the real artifact, its adapter report, domain-specific evidence, and a traceable review result. Document failures and changes, re-run the checks after correcting an artifact, and avoid marking the task complete before all required evidence is available. The separate-reviewer role in this sample is simulated for lifecycle testing and is not provider-authenticated.',
  },
]);
const DOCUMENT_SUPPORT=Object.freeze([
  {'adapter-docs':[
    'Software syntax does not establish that software runs',
    'Research citations are not fetched or fact-checked.',
    'markdown:structure',
  ]},
  {'adapter-docs':[
    'Separate manual proofs for the domain remain available',
    'Adapter output does **not** supply',
  ],'security-docs':[
    'An SHA-256 pins bytes, not truth.',
  ]},
  {'adapter-docs':[
    'A failing adapter result still blocks closure',
  ],'security-docs':[
    'Different actor names are checked but not authenticated.',
  ]},
]);
export function auditDocumentGuide(markdown, sourceTexts) {
  check(typeof markdown==='string','Document must be Markdown');
  check(sourceTexts && typeof sourceTexts==='object','Document quality audit requires primary sources');
  const parts=markdown.trim().split(/^## /m);
  check(parts.length===DOCUMENT_RUBRIC.length+1,'Document must have exactly three audited sections');
  check(norm(parts[0])==='# Using a Pro-Papa Adapter Result','Incorrect document title or preamble');
  const sections=[];
  for(let i=0;i<DOCUMENT_RUBRIC.length;i++){
    const rule=DOCUMENT_RUBRIC[i];
    const lines=parts[i+1].trim().split(/\r?\n/);
    check(lines.shift()?.trim()===rule.title,'Missing or reordered section '+rule.title);
    const actual=norm(lines.join(' '));
    check(actual===norm(rule.text),'Incorrect, contradictory or unsupported guidance in '+rule.title);
    const matchedSourceExcerpts=[];
    for(const [sourceId,excerpts] of Object.entries(DOCUMENT_SUPPORT[i])){
      const primary=sourceTexts[sourceId];
      check(typeof primary==='string' && primary.length>0,'Missing primary source for '+rule.title);
      for(const excerpt of excerpts){
        check(primary.includes(excerpt),
          'Section '+rule.title+' no longer supported by '+sourceId+': '+excerpt);
      }
      matchedSourceExcerpts.push({sourceId,excerpts});
    }
    sections.push({heading:rule.title,verifiedText:rule.text,
      exactCuratedParagraph:true,matchedSourceExcerpts});
  }
  return {validation:'fixed-document editorial rubric, not arbitrary natural-language reasoning',
    sections,validatedSections:sections.length};
}
