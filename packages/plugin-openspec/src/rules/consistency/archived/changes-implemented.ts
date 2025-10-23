import { RuleID, type RuntimeContext, Rule } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import type { ProjectFile, Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import { FailVerdict, PassVerdict, SkipVerdict, type Verdict } from '@opencheck/lib/types/OpenCheck/Verdict.ts';

import archivedChanges, { type ArchivedChange } from '@opencheck/plugin-openspec/context/changes/archived.ts';
import hasOpenspecDir from '@opencheck/plugin-openspec/context/has-openspec-dir.ts';
import project from '@opencheck/plugin-openspec/context/project.ts';

const id = RuleID('openspec/consistency/archived/changes-implemented');

const context = {
  hasOpenspecDir,
  project,
  archivedChanges,
} as const;

type Context = RuntimeContext<typeof context>;

async function when(context: Context): Promise<true | SkipVerdict> {
  if (!context.hasOpenspecDir) {
    return SkipVerdict('rule is not applicable to the project');
  }

  if (context.archivedChanges.length === 0) {
    return SkipVerdict('no archived changes found');
  }

  return true;
}

interface AIContext {
  projectDescription: ProjectFile;
  changeId: string;
  gitLog: string | undefined;
  gitDiffStat: string;
  gitDiff: string;
}

async function check(_runtime: Runtime, context: AIContext): Promise<Verdict> {
  return FailVerdict('ENOTIMPL\n' + JSON.stringify(context, null, 2));
}

async function checkUntrackedAdHocChange(
  { project }: Context,
  runtime: Runtime,
  { id }: ArchivedChange
): Promise<Verdict> {
  const dirtyHead = await runtime.gitDirtyHead(); // TODO: Make sure it is cached.
  return check(runtime, {
    projectDescription: project!,
    changeId: id,
    gitLog: undefined,
    gitDiffStat: await runtime.git.show(['--stat', dirtyHead]),
    gitDiff: await runtime.git.show(['--minimal', dirtyHead]),
  });
}

async function checkUntrackedProperChange(
  { project }: Context,
  runtime: Runtime,
  { id, creationCommit }: ArchivedChange
): Promise<Verdict> {
  const head = await runtime.gitHead(); // TODO: Make sure it is cached.
  const dirtyHead = await runtime.gitDirtyHead(); // TODO: Make sure it is cached.
  const diffRange = `${creationCommit}~..${dirtyHead}`; // We include creationCommit in the range.
  return check(runtime, {
    projectDescription: project!,
    changeId: id,
    gitLog: await runtime.gitLogNameStatus(creationCommit!, head),
    gitDiffStat: await runtime.git.diff(['--stat', diffRange]),
    gitDiff: await runtime.git.diff(['--minimal', diffRange]),
  });
}

async function checkTrackedAdHocChange(
  { project }: Context,
  runtime: Runtime,
  { id, archivalCommit }: ArchivedChange
): Promise<Verdict> {
  // The change is tracked, but was created archived. We assume it is implemented in the same commit,
  // as it seems to be the only sane workflow for this case.
  // TODO: Allow users to create deviations to explain to us where to look
  return check(runtime, {
    projectDescription: project!,
    changeId: id,
    gitLog: undefined,
    gitDiffStat: await runtime.git.show(['--stat', archivalCommit!]),
    gitDiff: await runtime.git.show(['--minimal', archivalCommit!]),
  });
}

async function checkTrackedProperChange(
  { project }: Context,
  runtime: Runtime,
  { id, creationCommit, archivalCommit }: ArchivedChange
): Promise<Verdict> {
  const diffRange = `${creationCommit}~..${archivalCommit}`; // We include creationCommit in the range.
  return check(runtime, {
    projectDescription: project!,
    changeId: id,
    gitLog: await runtime.gitLogNameStatus(creationCommit!, archivalCommit!),
    gitDiffStat: await runtime.git.diff(['--stat', diffRange]),
    gitDiff: await runtime.git.diff(['--minimal', diffRange]),
  });
}

async function checkArchivedChange(context: Context, runtime: Runtime, change: ArchivedChange): Promise<Verdict> {
  if (!change.proposal) {
    // Change is invalid per the context logic.
    // TODO: State that explicitly in data instead.
    return FailVerdict(`${change.changeDir.rpath}/proposal.md not found`);
  }

  if (!change.archivalCommit && !change.creationCommit) {
    return await checkUntrackedAdHocChange(context, runtime, change);
  }

  if (!change.archivalCommit) {
    return await checkUntrackedProperChange(context, runtime, change);
  }

  if (!change.creationCommit || change.creationCommit === change.archivalCommit) {
    return await checkTrackedAdHocChange(context, runtime, change);
  }

  return await checkTrackedProperChange(context, runtime, change);
}

function formatFailures(failures: (readonly [ArchivedChange, Verdict])[]) {
  const lines: string[] = [];
  let lastDir = '';
  for (const [{ changeDir }, failure] of failures) {
    if (lastDir !== changeDir.rpath) {
      lines.push('');
      lines.push(`${changeDir.rpath}:`);
      lines.push('');
      lastDir = changeDir.rpath;
    }

    lines.push('message' in failure ? failure.message : '(unknown)');
  }
  return lines.join('\n').trim();
}

async function run(context: Context, runtime: Runtime): Promise<Verdict> {
  if (!context.project) {
    return FailVerdict('openspec/project.md not found');
  }

  const verdicts = (
    await Promise.all(
      context.archivedChanges.map(async (c) => [c, await checkArchivedChange(context, runtime, c)] as const)
    )
  ).filter(([, v]) => v.status !== 'pass' && v.status !== 'skip');

  return verdicts.length === 0 ? PassVerdict() : FailVerdict(formatFailures(verdicts));
}

export default Rule({ id, context }, when, run);
