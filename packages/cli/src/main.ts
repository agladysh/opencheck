#! /usr/bin/env node --env-file-if-exists=.env --experimental-strip-types --disable-warning=ExperimentalWarning

import { FileSystem } from '@opencheck/lib/FileSystem.ts';
import { findProjectRootPath } from '@opencheck/lib/findProjectRootPath.ts';
import {
  type Context,
  ProjectFileContext,
  ProjectFilenamesContext,
  ProjectFilesContext,
} from '@opencheck/lib/types/OpenCheck/Context.ts';
import { ContextID, type ContextProducer } from '@opencheck/lib/types/OpenCheck/ContextProducer.ts';
import type {
  ContextRef,
  ContextRefMap,
  ContextTypeFromRef,
  RuleID,
  RuntimeContext,
} from '@opencheck/lib/types/OpenCheck/Rule.ts';
import type { Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import { contexts, rules } from '@opencheck/plugin-openspec'; // TODO: Use IPS
import ignore from 'ignore';
import { minimatch } from 'minimatch';
import type { Verdict } from '@opencheck/lib/types/OpenCheck/Verdict.ts';

class CliRuntime implements Runtime {
  private readonly fs: FileSystem;
  private readonly cache: ContextCache;

  constructor(fs: FileSystem, contextCache: ContextCache) {
    this.fs = fs;
    this.cache = contextCache;
  }

  async matchProjectFilenames(pattern: string | string[]): Promise<ProjectFilenamesContext> {
    if (!Array.isArray(pattern)) {
      pattern = [pattern];
    }

    const matchers = pattern.map((p) => minimatch.filter(p));

    // TODO: Ideally context would be of whatever fs data is.
    return ProjectFilenamesContext(this.fs.files.filter((f) => matchers.some((m) => m(f.rpath))));
  }

  async readMatchingProjectFiles(pattern: string | string[]): Promise<ProjectFilesContext> {
    const filenames = await this.matchProjectFilenames(pattern);

    return ProjectFilesContext(
      filenames.value.map((f) => ProjectFileContext({ entry: f, value: this.fs.readFile(f) }))
    );
  }

  async resolveContextMap<M extends ContextRefMap>(map: M): Promise<RuntimeContext<M>> {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(map).map(async ([key, ref]) => [key, await this.cache.resolve(this, ref)] as const)
      )
    ) as RuntimeContext<M>;
  }
}

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

// function setupDefaultOmitter(fs: FileSystem): ignore.Ignore {
//   const alwaysOmit = `
// .env
//   `.trim();

//   const defaultOmitter = ignore();
//   defaultOmitter.add(alwaysOmit);
//   defaultOmitter.add(readGitIgnore(fs.projectRootPath));

//   return defaultOmitter;
// }

class ContextCache {
  private readonly producers: Record<ContextID, ContextProducer> = {};
  private readonly cache: Record<ContextID, Context> = {};

  constructor(producers: Readonly<ContextProducer[]>) {
    this.producers = Object.fromEntries(producers.map((p) => [p.id, p]));
  }

  async resolve<T extends ContextRef>(runtime: Runtime, ref: T): Promise<ContextTypeFromRef<T>> {
    const id = ContextID(ref.id);
    const cached = this.cache[id];
    if (cached) {
      return this.check(ref, cached);
    }

    const producer = this.producers[id];
    if (!producer) {
      throw new Error(`Unknown ${ref.type} context id ${id}`);
    }

    const result = this.check(ref, await producer.run(runtime));
    this.cache[id] = result;
    return result;
  }

  private check<T extends ContextRef>(ref: T, context: Context): ContextTypeFromRef<T> {
    if (!context) {
      throw new Error(`bad implementation: ${ref.type} context for ${ref.id} is falsy`);
    }
    if (context.type !== ref.type) {
      throw new Error(`unexpected context "${ref.id}" type: got "${context.type}", expected "${ref.type}"`);
    }
    return context as ContextTypeFromRef<T>;
  }
}

async function main(): Promise<void> {
  const fs = setupFS(process.cwd());
  const cache = new ContextCache(contexts);
  const runtime = new CliRuntime(fs, cache);

  const verdicts: [RuleID, Verdict][] = [];

  for (const rule of rules) {
    const context = await runtime.resolveContextMap(rule.context);
    const when = await rule.when(context, runtime);
    if (when !== true) {
      verdicts.push([rule.id, when]);
      continue;
    }
    verdicts.push([rule.id, await rule.run(context, runtime)]);
  }

  console.error(verdicts);

  const fails = verdicts.filter(([, v]) => v.status === 'fail');
  if (fails.length > 0) {
    console.error(`found ${fails.length} fails`);
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error('Unexpected error:', error);
  process.exitCode = 1;
});
