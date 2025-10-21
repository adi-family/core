interface SingletonCtx<T> {
  init(): Promise<T>;
  get value(): Promise<T>;
  get reqValue(): T;
  reset(): void;
}

export function singleton<T>(init: (ctx: SingletonCtx<T>) => Promise<T>): SingletonCtx<T> {
  let value: T | null = null;

  const ctx = {
    reset() {
      value = null;
    },
    async init() {
      if (!value) {
        value = await init(ctx);
      }

      return value;
    },
    get value(): Promise<T> {
      return this.init();
    },
    get reqValue(): T {
      if (!value) throw new Error('Not initialized')
      return value;
    },
  }

  return ctx;
}
