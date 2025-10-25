import { idToTitle, responseToMarkdown } from '@opencheck/lib/toMarkdown.ts';
import { Rule, RuleID, type RuntimeContext } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import { AISelectOptions, type ProjectFile, type Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import { FailVerdict, PassVerdict, SkipVerdict, type Verdict } from '@opencheck/lib/types/OpenCheck/Verdict.ts';
import archivedChanges, { type ArchivedChange } from '@opencheck/plugin-openspec/context/changes/archived.ts';
import hasOpenspecDir from '@opencheck/plugin-openspec/context/has-openspec-dir.ts';
import project from '@opencheck/plugin-openspec/context/project.ts';
import { type } from 'arktype';

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

async function check(runtime: Runtime, context: AIContext): Promise<Verdict> {
  // TODO: Fix typings
  const system = (context: Record<string, unknown>) =>
    Object.entries(context)
      .map(([k, v]) =>
        !v
          ? undefined
          : `
# ${idToTitle(k)}

<${k}>
${typeof v === 'object' && 'value' in v ? String((v as Record<string, unknown>).value) : String(v)}
</${k}>
  `.trim()
      )
      .filter(Boolean)
      .join('\n\n');

  const role = `
 Senior Software Engineer and Specification Compliance Auditor
 `;

  const task = `
  Study the provided Project Description.
  Identify the Change "${context.changeId.trim()}" specification in the information provided below.
  Study the specification in detail.
  Study the provided diffs.
  Determine, whether the Change "${context.changeId.trim()}" was actually implemented in the diffs as specified.
 `;

  const standard = `
 All changes must strictly comply with the explicit requirements detailed
 in the change specification (proposal/tasks) and align with the Project Conventions
 (e.g., file structure, technology stack, commit message format) defined in the Project Description.
 `;

  const method = `
1. Extract explicit requirements from the change specification (proposal.md, tasks.md, spec/*.md) for the specified change ID.
2. Analyze the Git Diff to identify all affected files and content changes.
3. Cross-reference the implementation details in the diffs against every specified requirement,
   ensuring completeness and correctness.
4. Verify adherence to Project Conventions (e.g., file paths, content structure, commit message style).
5. Conclude compliance status.
`;

  console.log('Checking', context.changeId);

  // TODO: Extract base fields to a type
  // TODO: Update task and standard to match fields
  const response = await runtime.aiSelect({
    system: system({
      role,
      task,
      standard,
      method,
      ...context,
    }),
    user: 'Closely study the information provided above. Execute the Task objectively, dilligently and rigorously while adhering to the standard and method.',
    options: AISelectOptions([
      type({
        status: '"pass"',
        answer: `"Implementation is sound and rigorously satisfies the ${context.changeId} specification letter and spirit"`,
        specificationRequirements: 'string > 0',
        implementationEvidence: 'string > 0',
        analysis: 'string > 0',
        'remarks?': 'string > 0',
      }),
      type({
        status: '"pass"',
        answer: `"Implementation satisfies the ${context.changeId} specification with areas for improvement"`,
        specificationRequirements: 'string > 0',
        implementationEvidence: 'string > 0',
        analysis: 'string > 0',
        actionableRecommendations: 'string > 0',
        'remarks?': 'string > 0',
      }),
      type({
        status: '"fail"',
        answer: `"Implementation does not entirely satisfy the ${context.changeId} specification letter and / or or spirit"`,
        specificationRequirements: 'string > 0',
        implementationEvidence: 'string > 0',
        analysis: 'string > 0',
        actionableRecommendations: 'string > 0',
        'remarks?': 'string > 0',
      }),
      type({
        status: '"fail"',
        answer: `"Implementation does not satisfy the ${context.changeId} specification"`,
        specificationRequirements: 'string > 0',
        implementationEvidence: 'string > 0',
        analysis: 'string > 0',
        actionableRecommendations: 'string > 0',
        'remarks?': 'string > 0',
      }),
      type({
        status: '"fail"',
        answer: '"Uncertain, or Not sufficient information, or Unable to answer"',
        analysis: 'string > 0',
        requestForClarification: 'string > 0',
        'remarks?': 'string > 0',
      }),
    ]),
  });

  if (response.status === 'pass') {
    return PassVerdict(); // TODO: This loses information. Display it in verbose mode for notes and very verbose mode for remarks?
  }

  // TODO: For Fail verdicts: feed *current* spec and code, see if it resolves (was fixed later).
  //       If not, recommend amending archived spec via errata (implementation is better),
  //       or speccing and implementing fix (spec is better), or logging deviation (spec is better,
  //       but implementing it is not advisable or something).

  // TODO: Add dedicated implementation not provided clause, triggering git log analysis cascade,
  //       which would update the commits and redo (on happy path)

  // TODO: This probably means that this analysis is a part of the context (or third type: analysis/audit), not rule.
  //       Rule is what to do with the analysis

  delete response.status; // TODO: Consider removing more fields

  return FailVerdict(responseToMarkdown(response));
}

async function checkUntrackedAdHocChange(
  { project }: Context,
  runtime: Runtime,
  { id }: ArchivedChange
): Promise<Verdict> {
  const dirtyHead = await runtime.gitDirtyHead(); // TODO: Make sure it is cached.
  return await check(runtime, {
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
  return await check(runtime, {
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
  return await check(runtime, {
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
  return await check(runtime, {
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

  // TODO: We do need to be able to return several verdicts for nicer formatting.
  //       As well: highlight as Markdown on print unless disabled
  const verdicts: [ArchivedChange, Verdict][] = [];
  for (const change of context.archivedChanges) {
    verdicts.push([change, await checkArchivedChange(context, runtime, change)]);
  }
  const fails = verdicts.filter(([, v]) => v.status !== 'pass' && v.status !== 'skip');

  return fails.length === 0 ? PassVerdict() : FailVerdict(formatFailures(fails));
}

export default Rule({ id, context }, when, run);
