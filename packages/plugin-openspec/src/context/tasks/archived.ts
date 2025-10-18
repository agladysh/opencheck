import type { ProjectFilesContext } from '@opencheck/lib/types/OpenCheck/Context.ts';
import type { ContextProducer } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import type { Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import { ContextID } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';

const contextProducer: ContextProducer = {
  id: ContextID('openspec/tasks/archived'),

  async run(runtime: Runtime): Promise<ProjectFilesContext> {
    return runtime.readMatchingProjectFiles('openspec/changes/archived/**/tasks.md');
  },
};

export default contextProducer;
