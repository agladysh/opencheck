#! /usr/bin/env node --env-file-if-exists=.env --experimental-strip-types --disable-warning=ExperimentalWarning

import { FileSystem } from '@opencheck/lib/FileSystem.ts';
import { findProjectRootPath } from '@opencheck/lib/findProjectRootPath.ts';
import type { ContextRefMap, Rule, RuleID } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import type { Verdict } from '@opencheck/lib/types/OpenCheck/Verdict.ts';
import { contexts, rules } from '@opencheck/plugin-openspec'; // TODO: Use IPS
import chalk from 'chalk';
import ignore from 'ignore';
import pkg from '../package.json' with { type: 'json' };
import { CliRuntime } from './CliRuntime.ts';
import { ContextCache } from './ContextCache.ts';

function setupFS(cwdPath: string): FileSystem {
  const projectRootPath = findProjectRootPath(cwdPath);

  const alwaysIgnore = `
node_modules/
.git/
.DS_Store
  `.trim();

  const ignorer = ignore();
  ignorer.add(alwaysIgnore);

  return new FileSystem(projectRootPath, (path: string) => ignorer.ignores(path));
}

// TODO: Verify no duplicate IDs in contexts and rules.
async function main(): Promise<void> {
  const fs = setupFS(process.cwd());
  const cache = new ContextCache(contexts);
  const runtime = new CliRuntime(fs, cache);

  const verdicts: [RuleID, Verdict][] = [];

  process.stdout.write(`${chalk.green.bold(`OpenCheck`)} ${chalk.gray(`${pkg.name} ${pkg.version}`)}\n`);

  const runtimeRules = rules as readonly Rule<ContextRefMap>[];

  for (const rule of runtimeRules) {
    const context = await runtime.resolveContextMap(rule.context);
    const when = await rule.when(context, runtime);
    if (when !== true) {
      verdicts.push([rule.id, when]);
      continue;
    }
    verdicts.push([rule.id, await rule.run(context, runtime)]);
  }

  for (const [ruleId, verdict] of verdicts) {
    const color = verdict.status === 'skip' ? chalk.gray : chalk.redBright;
    process.stdout.write(`\n${color(verdict.status)}\t${ruleId}\n\n`);
    if ('message' in verdict) {
      process.stdout.write(`${verdict.message}\n`);
    }
  }

  const fails = verdicts.filter(([, v]) => v.status === 'fail');
  if (fails.length > 0) {
    console.error(`\nFound ${fails.length} fail(s)`);
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error('Unexpected error:', error);
  process.exitCode = 1;
});
