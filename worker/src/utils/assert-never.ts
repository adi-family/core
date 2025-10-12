/**
 * Exhaustiveness checking helper for discriminated unions.
 *
 * Use in switch statements to ensure all cases are handled:
 *
 * @example
 * switch (value.type) {
 *   case 'a': return handleA(value);
 *   case 'b': return handleB(value);
 *   default: assertNever(value); // Compiler error if case missing
 * }
 */
export function assertNever(..._v: never[]): never {
  throw new Error('Unreachable code: all cases should be handled');
}
