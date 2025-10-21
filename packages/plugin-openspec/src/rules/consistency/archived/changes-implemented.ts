import { FlagContext, ProjectDirnamesContext, ProjectFilesContext } from '@opencheck/lib/types/OpenCheck/Context.ts';
import { ContextRef, RuleID, type Rule, type RuntimeContext } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import { FailVerdict, PassVerdict, SkipVerdict, type Verdict } from '@opencheck/lib/types/OpenCheck/Verdict.ts';
import type { Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import type { FSEntryDir } from '@opencheck/lib/FileSystem.ts';
import { join } from 'path';

const id = RuleID('openspec/consistency/archived/changes-implemented');

const RuleContextMap = {
  applicable: ContextRef(FlagContext, 'openspec/has-openspec-dir'),
  project: ContextRef(ProjectFilesContext, 'openspec/project'),
  specs: ContextRef(ProjectFilesContext, 'openspec/specs'),
  changes: ContextRef(ProjectDirnamesContext, 'openspec/changes/archived'),
} as const;

type RuleContext = RuntimeContext<typeof RuleContextMap>;

async function checkArchivedChange(_context: RuleContext, changeDir: FSEntryDir, runtime: Runtime): Promise<Verdict> {
  // We need to determine if an archived change was actually implemented in the code
  // Given that full specs must include whatever is currently relevant of the change,
  // we should do "does code really implement the spec" validation separately.
  // Here we check formally, if the implementation attempt happened.
  // For this, we need:
  // - Archived change set documents (sits nicely in a directory)
  // - The implementation (see below)
  // To know what is this about:
  // - Project description
  // - Full set of specs
  // To avoid the case when the description and or specs are much newer than the older change
  // in scenario (C) below, and confusing the LLM, we get description and specs from Git
  // at the time of change archival at the TO point below.
  // Now, we should handle at least three scenarios:
  // - (A) change archival was not committed yet
  //       and the implementation is not committed yet either
  //       (performing change archival after the change was comitted seems a good idea,
  //       so this scenario might become a violation later)
  // - (B) change archival is not comitted yet, but the implementation was committed
  //       this is a well-formed scenario, in which this rule gates comitting the archival
  // - (C) change archival and the change were comitted a while ago
  //       this is a full retrospective audit scenario, later we might want not to verify this by default
  // We're working with git state between two points:
  // - FROM: change was created (we trace through git renames)
  //         edge cases:
  //         (1) change was rewritten upon archival so much that git rename cannot track
  //         this is clearly pathological with automated archival, so we do not handle it
  //         in the future we might want to fallback through change id
  //         (2) change was created, implemented and archived without being comitted to git pre-archival
  //         (this seems to be a bad form, we might want to fail on this in the future in a separate rule)
  //         in this case we cannot determine the FROM point, and choose to fail,
  //         as examining the full working copy is expensive and / or error-prone (and should be done in the full spec audit)
  //         later implementations might examine commit log with LLM to determine the range
  // - TO:   change was archived
  //         edge cases:
  //         (1) change archival is not committed yet, we treat the entire working copy dirty state (new files,
  //         not staged modifications, staged modifications) as a "commit"
  //         (2) same as FROM edge cases, where we fail
  // We feed to the LLM as the implementation context:
  // - (1) git log --name-status between FROM/TO
  // - (2) git diff between FROM/TO
  // NB: Another edge case to consider is when archival files are modified in the working copy.
  //     So far it seems it should not affect much.
  // In an ideal world, archive is read-only. Changes are permitted, but substantial changes should be a bad form.
  // In the future we might have a rule prohibiting commits (and working copy modifications)
  // making substantial changes to archived change proposal: new proposals should be created instead.

  // TODO: The above means that most of the contexts that come from the rule are not very useful,
  //       as we need the files from unknown commits.
  //       For now we should clean up the contexts and fetch manually,
  //       Later, ideally, we provide some nice abstractions for context trees in the opencheck.

  // We use change file texts from the working copy HEAD as is
  const changeFiles = await runtime.readMatchingProjectFiles(changeDir.rpath + '/**/*.md');
  if (changeFiles.value.length === 0) {
    return FailVerdict('change directory is empty');
  }

  // Since git works only with the files, we pick proposal.md as our representative file.
  // Note tasks.md is in danger of being "rewritten" on archival if all task boxes are ticked at once.
  const proposalFilePath = join(changeDir.rpath, 'proposal.md'); // TODO: Verify the file is there.
  console.log('XXX proposalFilePath', proposalFilePath);

  // 1. identify WHEN folder was renamed (last rename), use clean HEAD if rename is not committed
  // 2. identify WHEN folder was created (first commit), using original name (match by change id?)
  // 3. log from 2 to 1
  // 4. diff from 2 to 1, use dirty HEAD if rename is not committed

  const headCommit = await runtime.gitHead();
  console.log('XXX headCommit', headCommit);

  const archiveCommitted = await runtime.isFileTrackedInGit(proposalFilePath);
  console.log('XXX archiveCommitted', archiveCommitted);

  const archiveCommit = !archiveCommitted
    ? headCommit
    : await runtime.getFirstCommitWithoutRenames(proposalFilePath, headCommit);
  console.log('XXX archiveCommit', archiveCommit);

  const createCommit = await runtime.getFirstCommitWithRenames(proposalFilePath, headCommit);
  console.log('XXX createCommit', createCommit);

  const log =
    createCommit === archiveCommit
      ? await runtime.gitLogNameStatusSingle(archiveCommit) // Change created archived. TODO: should be a warning or worse
      : await runtime.gitLogNameStatus(`${createCommit}~`, archiveCommit); // We need to include createCommit, thus ~.
  console.log('XXX log', log);

  // TODO: Handle the case where all we need is git show for dirty head
  const lastCommit = archiveCommitted ? archiveCommit : await runtime.gitDirtyHead();
  console.log('XXX lastCommit', lastCommit);

  const diff =
    createCommit === lastCommit
      ? await runtime.git.show([lastCommit])
      : await runtime.git.diff(['--minimal', `${createCommit}~..${lastCommit}`]); // We need to include createCommit, thus ~.
  console.log('XXX diff', diff);

  return FailVerdict('ENOTIMPL');
}

const rule: Rule<typeof RuleContextMap> = {
  id,
  context: RuleContextMap,

  async when(context: RuleContext): Promise<true | SkipVerdict> {
    if (!context.applicable.value) {
      return SkipVerdict('rule is not applicable to the project');
    }

    if (context.project.value.length === 0) {
      // TODO: Probably should be a predicate too
      return SkipVerdict('openspec/project.md not found');
    }

    if (context.changes.value.length === 0) {
      // TODO: Probably should be a predicate too
      return SkipVerdict('no archived specs found');
    }

    return true;
  },

  async run(context: RuleContext, runtime: Runtime): Promise<Verdict> {
    const verdicts: [FSEntryDir, Verdict][] = [];

    for (const changeDir of context.changes.value) {
      const verdict = await checkArchivedChange(context, changeDir, runtime);

      verdicts.push([changeDir, verdict]);
    }

    const failures = verdicts.filter(([, v]) => v.status !== 'pass' && v.status !== 'skip');
    if (failures.length === 0) {
      return PassVerdict();
    }

    const lines: string[] = [];
    let lastDir = '';
    for (const [changeDir, failure] of failures) {
      if (lastDir !== changeDir.rpath) {
        lines.push('');
        lines.push(`${changeDir.rpath}:`);
        lines.push('');
        lastDir = changeDir.rpath;
      }

      lines.push('message' in failure ? failure.message : '(unknown)');
    }

    return FailVerdict(lines.join('\n').trim());
  },
};

export default rule;
