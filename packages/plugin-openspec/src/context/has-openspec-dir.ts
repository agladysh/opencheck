import { FlagContext } from '@opencheck/lib/types/OpenCheck/Context.ts';
import { ContextID, type ContextProducer } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import type { Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';

const contextProducer: ContextProducer = {
  id: ContextID('openspec/has-openspec-dir'),

  async run(runtime: Runtime): Promise<FlagContext> {
    return FlagContext((await runtime.matchProjectFilenames('openspec/**/*')).value.length > 0);
  },
};

export default contextProducer;
