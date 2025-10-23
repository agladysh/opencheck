import { Rule, RuleID, type RuntimeContext } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import type { ProjectFile } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
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

import archivedChanges from '@opencheck/plugin-openspec/context/changes/archived.ts';
import hasOpenspecDir from '@opencheck/plugin-openspec/context/has-openspec-dir.ts';

const id = RuleID('openspec/consistency/archived/tasks-completed');

const context = {
  hasOpenspecDir,
  archivedChanges,
} as const;

type Context = RuntimeContext<typeof context>;

async function checkTasksFile(fileContext: ProjectFile): Promise<VFileMessage[]> {
  const file = new VFile(fileContext.value);
  file.path = fileContext.entry.rpath;

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

async function when(context: Context): Promise<true | SkipVerdict> {
  if (!context.hasOpenspecDir) {
    return SkipVerdict('rule is not applicable to the project');
  }

  if (context.archivedChanges.length === 0) {
    return SkipVerdict('no archived changes found');
  }

  return true;
}

function formatMessages(messages: VFileMessage[]) {
  const result: string[] = [];

  let lastFile = '';
  for (const message of messages) {
    if (lastFile !== message.file) {
      result.push(`\n${message.file}: ${message.note}\n\n`);
      lastFile = String(message.file);
    }

    result.push(`\t${message.line}:${message.column}\t${String(message.message)}\n`);
  }

  return result.join('').trim();
}

async function run(context: Context): Promise<Verdict> {
  const messages = (
    await Promise.all(
      context.archivedChanges.map(async (f) =>
        f.tasks ? await checkTasksFile(f.tasks) : new VFileMessage(`no tasks.md file found for archived change ${f.id}`)
      )
    )
  ).flat();

  return messages.length === 0 ? PassVerdict() : FailVerdict(formatMessages(messages));
}

export default Rule({ id, context }, when, run);
