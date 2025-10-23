import { ContextID, ContextProducer } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import type { Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';

const id = ContextID('openspec/has-openspec-dir');

async function run(runtime: Runtime): Promise<boolean> {
  return (await runtime.matchProjectFilenames('openspec/**/*')).length > 0;
}

export default ContextProducer({ id }, run);
