import { ContextProducer } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import type { ProjectFile, Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import { ContextID } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';

const id = ContextID('openspec/project');

async function run(runtime: Runtime): Promise<ProjectFile | undefined> {
  return (await runtime.readMatchingProjectFiles('openspec/project.md'))[0];
}

export default ContextProducer({ id }, run);
