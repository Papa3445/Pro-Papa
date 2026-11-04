// PP-0010 — opt-in, host-local release gate; never intercepts ChatGPT turns.
// The trusted caller supplies producer and publisher functions out of band.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createReferenceHost } from './reference-host.mjs';
import { verifyReleasedExecution } from './execution-trace.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const TEXT = /^[\x20-\x7e]{1,80}$/;
const deny = reason => Object.freeze({ status: 'not_released', reason });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sameDigest = (left, right) => typeof left === 'string' &&
  typeof right === 'string' && SHA256.test(left) && SHA256.test(right) &&
  timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
const invalid = () => { throw new TypeError('Invalid trusted PDF release configuration'); };

/**
 * Construction must happen in an authorized, separate Node host, not from
 * user-controlled MCP arguments. Produce returns actual PDF bytes; publish
 * must persist those exact bytes and independently read back their hash.
 *
 * A custom validationHost exists for offline negative tests and trusted host
 * adapters only. Passing user-supplied host objects is an unsafe bypass.
 */
export function createPdfReleaseWorkflow({
  enabled = false, produce, publish, requiredText,
  expectedSha256 = null, validationHost = null,
} = {}) {
  if (typeof enabled !== 'boolean' || typeof produce !== 'function' ||
      typeof publish !== 'function' || !Array.isArray(requiredText) ||
      requiredText.length < 1 || requiredText.length > 8 ||
      requiredText.some(x => typeof x !== 'string' || !TEXT.test(x)) ||
      new Set(requiredText).size !== requiredText.length ||
      !(expectedSha256 === null ||
        (typeof expectedSha256 === 'string' && SHA256.test(expectedSha256))) ||
      !(validationHost === null || typeof validationHost?.execute === 'function')) invalid();

  const phrases = Object.freeze([...requiredText]);
  const host = validationHost ?? createReferenceHost({
    artifactValidationEnabled: true, traceMode: 'enforced',
  });
  return Object.freeze({
    async run(...overrides) {
      // A request cannot register tools, change checks, or force publication.
      if (overrides.length) return deny('untrusted_override');
      if (!enabled) return deny('disabled');
      let produced;
      try { produced = await produce(); }
      catch { return deny('producer_failed'); }
      if (!Buffer.isBuffer(produced) || !produced.length ||
          produced.length > 32768) return deny('invalid_artifact');

      // Own a private copy so an asynchronous producer cannot mutate bytes
      // between validation, hash comparison, and publication.
      const bytes = Buffer.from(produced);
      const identity = hash(bytes);
      if (expectedSha256 !== null && !sameDigest(identity, expectedSha256))
        return deny('stale_or_mismatched_artifact');

      let response;
      try {
        response = await host.execute({
          objective: 'Validate actual supplied PDF bytes before release',
          capability: 'artifact.validate',
          inputs: {
            authorization: 'validate_supplied_bytes_only',
            format: 'application/pdf', dataBase64: bytes.toString('base64'),
            mustContain: phrases,
          },
        });
      } catch { return deny('validator_unavailable'); }

      // Receipt-only success, simulated audit, stale response, wrong route,
      // malformed trace and mismatched bytes all fail closed.
      const output = response?.execution?.output;
      if (response?.status !== 'completed' ||
          !verifyReleasedExecution(response) ||
          response.capability !== 'artifact.validate' ||
          response.trace?.auditRequired !== false ||
          response.audit?.status !== 'not_requested' ||
          response.execution?.provenance?.provider !== 'local-node' ||
          response.execution?.provenance?.operation !== 'artifact.validate' ||
          output?.format !== 'application/pdf' || output.mechanicalOnly !== true ||
          output.byteLength !== bytes.length ||
          !sameDigest(output.sha256, identity) ||
          !Number.isSafeInteger(output.pageCount) || output.pageCount < 1 ||
          output.requiredChecks !== phrases.length ||
          output.matchedChecks !== phrases.length) return deny('validation_failed');

      try {
        const acknowledgment = await publish(Buffer.from(bytes), Object.freeze({
          sha256: identity, byteLength: bytes.length, format: 'application/pdf',
        }));
        // A publisher may have written before failing: never falsely claim
        // "not released" or retry an effect whose outcome is ambiguous.
        if (!acknowledgment || !sameDigest(acknowledgment.sha256, identity) ||
            acknowledgment.byteLength !== bytes.length)
          return Object.freeze({status: 'needs_reconciliation',
            reason: 'publication_unconfirmed'});
      } catch {
        return Object.freeze({status: 'needs_reconciliation',
          reason: 'publication_unconfirmed'});
      }
      return Object.freeze({status: 'released', format: 'application/pdf',
        sha256: identity, byteLength: bytes.length, pageCount: output.pageCount,
        requiredChecks: phrases.length, publisherVerified: true,
        mechanicalOnly: true});
    },
  });
}
