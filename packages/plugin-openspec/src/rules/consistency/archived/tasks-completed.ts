import { FlagContext, ProjectFilesContext } from '@opencheck/lib/types/OpenCheck/Context.ts';
import { ContextRef, RuleID, type Rule, type RuntimeContext } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import type { SkipVerdict, Verdict } from '@opencheck/lib/types/OpenCheck/Verdict.ts';
import { vFileMessagesToFailVerdict } from '@opencheck/lib/vFileMessagesToFailVerdict.ts';
import { toMarkdown } from 'mdast-util-to-markdown';
import remarkGfm from 'remark-gfm';
import remarkMessageControl from 'remark-message-control';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { Parent } from 'unist';
import { visitParents } from 'unist-util-visit-parents';
import { VFile } from 'vfile';
import { VFileMessage } from 'vfile-message';
import pkg from '../../../../package.json' with { type: 'json' };
import { changeIdFromPath } from '../../../util/changeIdFromPath.ts';

const id = RuleID('openspec/consistency/archived/tasks-completed');

const RuleContextMap = {
  applicable: ContextRef(FlagContext, 'openspec/has-openspec-dir'),
  files: ContextRef(ProjectFilesContext, 'openspec/tasks/archived'),
} as const;

type RuleContext = RuntimeContext<typeof RuleContextMap>;

// TODO: Consider trying xo instead of raw eslint
// TODO: Add exports/package.json linter

export async function delme(md: string) {
  console.log(md);

  const file = new VFile(md);
  file.path = 'archive/2025-10-18-my-change/tasks.md';

  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMessageControl, { name: pkg.name, enable: [id], known: [id] })
    .parse(file);

  const messages: VFileMessage[] = [];

  visitParents(
    tree,
    {
      type: 'listItem',
      checked: false,
    },
    (node: Parent, parents) => {
      console.log(node);
      const task = toMarkdown(node.children[0] as Parameters<typeof toMarkdown>[0]).trim();
      const msg = new VFileMessage(
        `Change "${changeIdFromPath(file.path)}" was archived with incomplete task "${task}"`,
        {
          ancestors: [...parents, node],
          ruleId: id,
          source: pkg.name,
          // url: TODO
        }
      );
      msg.fatal = true;
      msg.actual = `- [ ] ${task}`;
      msg.expected = [`- [x] ${task}`];
      msg.note = 'Every task in a change proposal must be marked as completed before the proposal is archived';
      msg.file = file.path;
      messages.push(msg);
    }
  );

  console.log(vFileMessagesToFailVerdict(messages));
}

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
