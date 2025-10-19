import { FlagContext, ProjectFilesContext, type ProjectFileContext } from '@opencheck/lib/types/OpenCheck/Context.ts';
import { ContextRef, RuleID, type Rule, type RuntimeContext } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import { FailVerdict, PassVerdict, SkipVerdict, type Verdict } from '@opencheck/lib/types/OpenCheck/Verdict.ts';
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

const id = RuleID('openspec/consistency/archived/tasks-completed');

const RuleContextMap = {
  applicable: ContextRef(FlagContext, 'openspec/has-openspec-dir'),
  files: ContextRef(ProjectFilesContext, 'openspec/tasks/archived'),
} as const;

type RuleContext = RuntimeContext<typeof RuleContextMap>;

// TODO: Consider trying xo instead of raw eslint
// TODO: Add exports/package.json linter

async function checkTasksFile(fileContext: ProjectFileContext): Promise<VFileMessage[]> {
  const file = new VFile(fileContext.value.value);
  file.path = fileContext.value.entry.rpath;

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
      const task = toMarkdown(node.children[0] as Parameters<typeof toMarkdown>[0]).trim();
      const msg = new VFileMessage(`Task "${task}" must be completed`, {
        ancestors: [...parents, node],
        ruleId: id,
        source: pkg.name,
        // url: TODO
      });
      msg.fatal = true;
      msg.actual = `- [ ] ${task}`;
      msg.expected = [`- [x] ${task}`];
      msg.note = 'Archived change may not have incomplete tasks';
      msg.file = file.path;
      messages.push(msg);
    }
  );

  return messages;
}

const rule: Rule<typeof RuleContextMap> = {
  id,
  context: RuleContextMap,

  async when(context: RuleContext): Promise<true | SkipVerdict> {
    if (!context.applicable.value) {
      return SkipVerdict('rule is not applicable to the project');
    }

    if (context.files.value.length === 0) {
      return SkipVerdict('no archived tasks found');
    }

    return true;
  },

  async run(context: RuleContext): Promise<Verdict> {
    const messages = (await Promise.all(context.files.value.map((f) => checkTasksFile(f)))).flat();
    if (messages.length === 0) {
      return PassVerdict();
    }

    const result: string[] = [];

    let lastFile = '';
    for (const message of messages) {
      if (lastFile !== message.file) {
        result.push(`\n${message.file}: ${message.note}\n\n`);
        lastFile = String(message.file);
      }

      result.push(`\t${message.line}:${message.column}\t${String(message.message)}\n`);
    }

    return FailVerdict(result.join('').trim());
  },
};

export default rule;
