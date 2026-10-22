// PP-0007 structured, deterministic, read-only memo draft. No invented claims.
const fail = () => { throw Error('Invalid bounded memo inputs'); };
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const controls = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const text = (v, max) => typeof v === 'string' && v.length > 0 &&
  v.length <= max && v.trim() === v && !controls.test(v);
const boundedStrings = (v, maxCount) => Array.isArray(v) &&
  v.length >= 1 && v.length <= maxCount &&
  Array.from({length:v.length}, (_,i) => Object.hasOwn(v,i)).every(Boolean) &&
  v.every(item => text(item,280));
/**
 * Builds an in-memory memo ONLY from the caller's text, without adding facts,
 * implying verification, performing a general LLM composition, or exporting.
 */
export function draftMemo(input) {
  if (!plain(input) || !Object.keys(input).every(k =>
      ['to','subject','purpose','facts','actions'].includes(k)) ||
      !text(input.to,120) || !text(input.subject,120) ||
      !text(input.purpose,600) || !boundedStrings(input.facts,6) ||
      !boundedStrings(input.actions,6)) fail();
  const lines = [
    'MEMORANDUM (DRAFT — UNVERIFIED)', 'To: ' + input.to,
    'Subject: ' + input.subject, '', 'Purpose', input.purpose,
    '', 'Provided facts (not independently verified)',
    ...input.facts.map((v,i) => (i + 1) + '. ' + v),
    '', 'Proposed actions (provided by requester)',
    ...input.actions.map((v,i) => (i + 1) + '. ' + v),
    '', 'This draft only organizes requester-supplied content; verify before use.',
  ];
  return {
    format: 'plain-text', status: 'draft_unverified',
    title: input.subject, factCount: input.facts.length,
    actionCount: input.actions.length, text: lines.join('\n'),
    limitations: 'No independently checked sources, judgment, file write, email or publication',
  };
}
