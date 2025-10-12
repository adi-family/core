export function assertNever(..._v: never[]): never {
  throw new Error('Unreachable code: all cases should be handled');
}
