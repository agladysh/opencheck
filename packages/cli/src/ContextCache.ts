import type { ContextProducer, ContextProducerResult } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import type { Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';

export class ContextCache {
  private readonly cache: Map<ContextProducer, unknown>;

  constructor() {
    this.cache = new Map();
  }

  async resolve<P extends ContextProducer>(runtime: Runtime, producer: P): Promise<ContextProducerResult<P>> {
    if (this.cache.has(producer)) {
      return this.cache.get(producer) as ContextProducerResult<P>;
    }

    const result = await producer.run(runtime);
    this.cache.set(producer, result);

    return result as ContextProducerResult<P>;
  }
}
