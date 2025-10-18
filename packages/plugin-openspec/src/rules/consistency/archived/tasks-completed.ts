import { ProjectFilesContext, FlagContext } from '@opencheck/lib/types/OpenCheck/Context.ts';
import { ContextRef, RuleID, type RuntimeContext, type Rule } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import type { SkipVerdict, Verdict } from '@opencheck/lib/types/OpenCheck/Verdict.ts';

const id = RuleID('openspec/consistency/archived/tasks-completed');

const RuleContextMap = {
  applicable: ContextRef(FlagContext, 'openspec/has-openspec-dir'),
  files: ContextRef(ProjectFilesContext, 'openspec/tasks/archived'),
} as const;

type RuleContext = RuntimeContext<typeof RuleContextMap>;

const rule: Rule<typeof RuleContextMap> = {
  id,
  context: RuleContextMap,

  async when(context: RuleContext): Promise<true | SkipVerdict> {
    if (!context.applicable.value) {
      return { status: 'skip', message: 'rule is not applicable to the project' };
    }

    if (context.files.value.length === 0) {
      return { status: 'skip', message: 'no archived tasks found' };
    }

    return true;
  },

  async run(_context: RuleContext): Promise<Verdict> {
    // TODO: Find unticked checkboxes
    return { status: 'fail', message: 'ENOTIMPL' };
  },
};

export default rule;
