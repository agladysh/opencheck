import type { Context } from '@opencheck/lib/types/OpenCheck/Context.ts';
import { ContextID, type ContextProducer } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import type { ContextRef, ContextTypeFromRef } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import type { Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';

export class ContextCache {
  private readonly producers: Record<ContextID, ContextProducer> = {};
  private readonly cache: Record<ContextID, Context> = {};

  constructor(producers: Readonly<ContextProducer[]>) {
    this.producers = Object.fromEntries(producers.map((p) => [p.id, p]));
  }

  async resolve<T extends ContextRef>(runtime: Runtime, ref: T): Promise<ContextTypeFromRef<T>> {
    const id = ContextID(ref.id);
    const cached = this.cache[id];
    if (cached) {
      return this.check(ref, cached);
    }

    const producer = this.producers[id];
    if (!producer) {
      throw new Error(`Unknown ${ref.type} context id ${id}`);
    }

    const result = this.check(ref, await producer.run(runtime));
    this.cache[id] = result;
    return result;
  }

  private check<T extends ContextRef>(ref: T, context: Context): ContextTypeFromRef<T> {
    if (!context) {
      throw new Error(`bad implementation: ${ref.type} context for ${ref.id} is falsy`);
    }
    if (context.type !== ref.type) {
      throw new Error(`unexpected context "${ref.id}" type: got "${context.type}", expected "${ref.type}"`);
    }
    return context as ContextTypeFromRef<T>;
  }
}
