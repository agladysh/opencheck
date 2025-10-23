import { ContextProducer } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import { ContextID } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import type { GitObjectName, ProjectFile, Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import type { FSEntryDir, FSEntryFile } from '@opencheck/lib/FileSystem.ts';
import { join } from 'path';
import { changeIdFromPath } from '../../util/changeIdFromPath.ts';

// TODO: Move to the lib package.
function findFileInDir(dir: FSEntryDir, filename: string): FSEntryFile | undefined {
  const rpath = join(dir.rpath, filename);
  return dir.entries.find((e): e is FSEntryFile => e.type === 'file' && e.rpath === rpath);
}

// TODO: Move to util?
export interface ArchivedChange {
  id: string;
  changeDir: FSEntryDir;
  proposal: ProjectFile | undefined;
  tasks: ProjectFile | undefined;
  archivalCommit: GitObjectName | undefined;
  creationCommit: GitObjectName | undefined;
}

// TODO: Move to util?
async function loadArchivedChange(runtime: Runtime, changeDir: FSEntryDir): Promise<ArchivedChange> {
  const id = changeIdFromPath(changeDir.rpath);

  // We use proposal.md as the marker, since Git does not track directories.
  // NB: tasks.md is in danger of being "rewritten" on archival if all task boxes are ticked at once.
  // TODO: Work with earliest (creation) and latest (archival) file in the directory instead.
  const proposalFile = findFileInDir(changeDir, 'proposal.md');
  if (!proposalFile) {
    // We treat change requests without a proposal file as malformed and skip loading altogether.
    return {
      id,
      changeDir,
      proposal: undefined,
      tasks: undefined,
      archivalCommit: undefined,
      creationCommit: undefined,
    };
  }

  const tasksFile = findFileInDir(changeDir, 'tasks.md');

  const isTracked = await runtime.isFileTrackedInGit(proposalFile.rpath);

  const headCommit = await runtime.gitHead(); // TODO: Cache this.

  return {
    id,
    changeDir,
    proposal: proposalFile ? await runtime.readFile(proposalFile) : undefined,
    tasks: tasksFile ? await runtime.readFile(tasksFile) : undefined,
    archivalCommit: !isTracked ? undefined : await runtime.getFirstCommitWithoutRenames(proposalFile.rpath, headCommit),
    creationCommit: await runtime.getFirstCommitWithRenames(proposalFile.rpath, headCommit),
  };
}

const id = ContextID('openspec/changes/archived');

async function run(runtime: Runtime): Promise<ArchivedChange[]> {
  return await Promise.all(
    (await runtime.matchProjectDirnames('openspec/changes/archive/*/')).map((d) => loadArchivedChange(runtime, d))
  );
}

export default ContextProducer({ id }, run);
