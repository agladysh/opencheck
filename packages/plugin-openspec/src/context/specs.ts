import { ContextProducer } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import type { ProjectFile, Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import { ContextID } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';

const id = ContextID('openspec/specs');

async function run(runtime: Runtime): Promise<ProjectFile[]> {
  return runtime.readMatchingProjectFiles('openspec/specs/**/*.md');
}

export default ContextProducer({ id }, run);
