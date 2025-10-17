#! /usr/bin/env node --env-file-if-exists=.env --experimental-strip-types --disable-warning=ExperimentalWarning

async function main(): Promise<void> {
  console.log('opencheck');
}

void main().catch((error: unknown) => {
  console.error('Unexpected error:', error);
  process.exitCode = 1;
});
