import type { ProjectDirnamesContext } from '@opencheck/lib/types/OpenCheck/Context.ts';
import type { ContextProducer } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import type { Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import { ContextID } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';

const contextProducer: ContextProducer = {
  id: ContextID('openspec/changes/archived'),

  async run(runtime: Runtime): Promise<ProjectDirnamesContext> {
    return runtime.matchProjectDirnames('openspec/changes/archive/*/');
  },
};

export default contextProducer;
