// PP-0007: strict, deterministic ISO calendar-date parser and reusable source.
export function parseIsoCalendarDate(value) {
  // Supported grammar intentionally excludes timestamps, offsets, and 00-99 JS year quirks.
  if (typeof value !== 'string' ||
      !/^[12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day) return null;
  return { iso: value, year, month, day,
    weekday: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getUTCDay()] };
}
const fail = () => { throw Error('Invalid bounded ISO-date source request'); };
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
/**
 * Fixed implementation emitted from the very same locally tested function;
 * no untrusted text is interpolated into executable code, ever.
 */
export function generateIsoDateModule(input) {
  if (!plain(input) || Object.keys(input).some(key => key !== 'examples') ||
      !Array.isArray(input.examples) || input.examples.length < 1 ||
      input.examples.length > 12 ||
      !Array.from({length:input.examples.length},(_,i)=>Object.hasOwn(input.examples,i)).every(Boolean) ||
      input.examples.some(s=>typeof s!=='string' || s.length<1 || s.length>32 ||
        !/^[0-9A-Za-z:._+/-]+$/.test(s))) fail();
  const source = 'export ' + parseIsoCalendarDate.toString() + '\n';
  const examples = input.examples.map(value => ({ input:value, parsed:parseIsoCalendarDate(value) }));
  return { language:'javascript', moduleFormat:'esm', fileName:'parse-iso-date.mjs',
    source, examples,
    limitations:'Supports Gregorian YYYY-MM-DD only for years 1000-2999; invalid inputs return null; no timezones, non-ISO dates, file writes, user-code execution or LLM authoring' };
}
