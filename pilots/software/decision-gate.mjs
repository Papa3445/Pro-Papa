/**
 * Tiny pure decision gate used only for the PP-0003 software pilot.
 * It is not a substitute for the provider-authenticated GitHub review gate.
 */
export function mayAccept({ approved, currentHead, outstandingChanges }) {
  if ([approved, currentHead, outstandingChanges].some(value => typeof value !== 'boolean')) {
    throw new TypeError('decision inputs must all be booleans');
  }
  return approved && currentHead && !outstandingChanges;
}
