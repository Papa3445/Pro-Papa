// PP-0007 bounded, read-only weekly plan. No side effects or LLM output claims.
const plain = x => x !== null && typeof x === 'object' &&
  !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype ||
    Object.getPrototypeOf(x) === null);
const fail = () => { throw Error('Invalid bounded weekly-plan inputs'); };
const ID = /^[a-z][a-z0-9-]{0,31}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
// Standalone module users may not have passed the reference host's JSON snapshot.
const denseArray = (a, min, max) => Array.isArray(a) &&
  a.length >= min && a.length <= max &&
  Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
/**
 * Convert an explicitly ordered set of 1-5 work items into a five-day,
 * Monday-starting *draft*. Tasks consume exactly one day each and dependencies
 * must precede their dependents in input order. This is NOT a general-purpose
 * scheduler, resource optimizer, calendar integration or date interpreter.
 */
export function buildWeeklyPlan(inputs) {
  if (!plain(inputs) || !Object.keys(inputs).every(k => ['weekOf', 'tasks'].includes(k)) ||
      typeof inputs.weekOf !== 'string' || !ISO.test(inputs.weekOf) ||
      !denseArray(inputs.tasks, 1, 5)) fail();
  const first = new Date(inputs.weekOf + 'T00:00:00.000Z');
  if (!Number.isFinite(first.getTime()) ||
      first.toISOString().slice(0, 10) !== inputs.weekOf ||
      first.getUTCDay() !== 1) fail();
  const seen = new Set();
  const entries = inputs.tasks.map((task, index) => {
    if (!plain(task) || !Object.keys(task).every(k => ['id', 'title', 'dependsOn'].includes(k)) ||
        typeof task.id !== 'string' || !ID.test(task.id) || seen.has(task.id) ||
        typeof task.title !== 'string' || !task.title.trim() ||
        task.title !== task.title.trim() || task.title.length > 120 ||
        /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(task.title) ||
        (task.dependsOn !== undefined &&
          (!denseArray(task.dependsOn, 0, 4) ||
          task.dependsOn.some(d => typeof d !== 'string' || !seen.has(d)) ||
          new Set(task.dependsOn).size !== task.dependsOn.length))) fail();
    seen.add(task.id);
    const date = new Date(first.getTime() + index * 86_400_000);
    return { date: date.toISOString().slice(0, 10), id: task.id,
      title: task.title, dependsOn: [...(task.dependsOn ?? [])] };
  });
  return {
    weekOf: inputs.weekOf, timeBasis: 'UTC date-only; not an appointment',
    capacityDays: 5, scheduledCount: entries.length,
    remainingDays: 5 - entries.length, entries,
    limitations: 'One sequential one-day task per weekday; no effort estimates, resources or external calendar writes',
  };
}
