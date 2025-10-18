#! /usr/bin/env node --env-file-if-exists=.env --experimental-strip-types --disable-warning=ExperimentalWarning

import { delme } from '@opencheck/plugin-openspec/rules/consistency/archived/tasks-completed.ts';

async function main(): Promise<void> {
  console.log('opencheck');
  await delme(`
# AI

- [ ] do
- [x] some
- work
- [ ] now
`);
}

void main().catch((error: unknown) => {
  console.error('Unexpected error:', error);
  process.exitCode = 1;
});
