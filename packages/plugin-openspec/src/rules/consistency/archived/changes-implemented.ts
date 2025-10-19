import { FlagContext, ProjectDirnamesContext, ProjectFilesContext } from '@opencheck/lib/types/OpenCheck/Context.ts';
import { ContextRef, RuleID, type Rule, type RuntimeContext } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import { FailVerdict, PassVerdict, SkipVerdict, type Verdict } from '@opencheck/lib/types/OpenCheck/Verdict.ts';
import type { Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import type { FSEntryDir } from '@opencheck/lib/FileSystem.ts';

const id = RuleID('openspec/consistency/archived/changes-implemented');

const RuleContextMap = {
  applicable: ContextRef(FlagContext, 'openspec/has-openspec-dir'),
  project: ContextRef(ProjectFilesContext, 'openspec/project'),
  specs: ContextRef(ProjectFilesContext, 'openspec/specs'),
  changes: ContextRef(ProjectDirnamesContext, 'openspec/changes/archived'),
} as const;

type RuleContext = RuntimeContext<typeof RuleContextMap>;

async function checkArchivedChange(
  _context: RuleContext,
  _change: ProjectFilesContext,
  _runtime: Runtime
): Promise<Verdict> {
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
      const files = await runtime.readMatchingProjectFiles(changeDir.rpath + '/**/*.md');
      if (files.value.length === 0) {
        verdicts.push([changeDir, FailVerdict('change directory is empty')]);
        continue;
      }

      const verdict = await checkArchivedChange(context, files, runtime);

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
