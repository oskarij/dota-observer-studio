import { isRecord } from './validation.js';

type Validator = (value: unknown) => boolean;

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const nonnegative: Validator = (value) => finite(value) && value >= 0;
const positive: Validator = (value) => finite(value) && value > 0;
const string: Validator = (value) => typeof value === 'string';
const boolean: Validator = (value) => typeof value === 'boolean';
const oneOf =
  (...values: unknown[]): Validator =>
  (value) =>
    values.includes(value);
const color: Validator = (value) =>
  typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);

function fields(value: unknown, rules: Record<string, Validator>): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, item]) => Object.hasOwn(rules, key) && rules[key]?.(item) === true
    )
  );
}

export function validPartialSettings(value: unknown): boolean {
  return fields(value, {
    position: (item) => fields(item, { x: finite, y: finite }),
    anchor: (item) =>
      fields(item, { x: oneOf('left', 'center', 'right'), y: oneOf('top', 'center', 'bottom') }),
    size: positive,
    font: (item) => fields(item, { family: string, weight: positive, italic: boolean }),
    color,
    shadow: (item) => fields(item, { color, blur: nonnegative, offsetX: finite, offsetY: finite })
  });
}
