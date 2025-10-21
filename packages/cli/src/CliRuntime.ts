import { mkdtemp, rm } from 'fs/promises';
import { minimatch } from 'minimatch';
import { tmpdir } from 'os';
import type { FileSystem } from '@opencheck/lib/FileSystem.ts';
import {
  ProjectFilenamesContext,
  ProjectDirnamesContext,
  ProjectFilesContext,
  ProjectFileContext,
} from '@opencheck/lib/types/OpenCheck/Context.ts';
import type { ContextRefMap, RuntimeContext } from '@opencheck/lib/types/OpenCheck/Rule.ts';
import { GitObjectName, type Runtime } from '@opencheck/lib/types/OpenCheck/Runtime.ts';
import { join } from 'path/posix';
import { simpleGit, type SimpleGit } from 'simple-git';
import type { ContextCache } from './ContextCache.ts';
import { copyFile } from 'fs/promises';
import { $ } from 'execa';

async function withTmpDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const tmpDir = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(tmpDir);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export class CliRuntime implements Runtime {
  private readonly fs: FileSystem;
  private readonly cache: ContextCache;

  readonly git: SimpleGit;
  readonly $: typeof $;

  constructor(fs: FileSystem, contextCache: ContextCache) {
    this.fs = fs;
    this.git = simpleGit(fs.projectRootPath);
    this.$ = $({ cwd: this.fs.projectRootPath });
    this.cache = contextCache;
  }

  // TODO: Move Git stuff to a separate namespace

  async isGitDirty(): Promise<boolean> {
    await this.$`git update-index --really-refresh`;
    const result = await this.$`git diff-index --quiet HEAD`;
    return result.exitCode !== 0;
  }

  async gitHead(): Promise<GitObjectName> {
    return GitObjectName((await this.git.revparse('HEAD')).trim());
  }

  async gitLogNameStatus(from: string, to: string): Promise<string> {
    return (await this.$`git log --name-status ${from}..${to}`).stdout;
  }

  // TODO: This is probably a git show call with options
  async gitLogNameStatusSingle(commit: string): Promise<string> {
    return (await this.$`git log --name-status ${commit} -1`).stdout;
  }

  // TODO: Technically we should lock git because tree object is created dangling and might be collected as we work
  async gitDirtyHead(): Promise<GitObjectName> {
    return GitObjectName(
      await this.withTmpGitIndex(async (git: SimpleGit) => {
        await git.add('.');
        return (await git.raw('write-tree')).trim();
      })
    );
  }

  private async getFirstCommit(rpath: string, lastCommit: GitObjectName, follow: boolean): Promise<GitObjectName> {
    const result = await this
      .$`git log --diff-filter=A --format=%H ${follow ? '--follow' : '--no-follow'} ${lastCommit} -1 -- ${rpath}`;
    return GitObjectName(result.stdout.trim());
  }

  // Assumes rpath exists in lastCommit.
  async getFirstCommitWithRenames(rpath: string, lastCommit: GitObjectName): Promise<GitObjectName> {
    return this.getFirstCommit(rpath, lastCommit, true);
  }

  async getFirstCommitWithoutRenames(rpath: string, lastCommit: GitObjectName): Promise<GitObjectName> {
    return this.getFirstCommit(rpath, lastCommit, false);
  }

  async isFileTrackedInGit(rpath: string): Promise<boolean> {
    return (await this.$`git ls-files ${rpath}`).stdout.trim() !== '';
  }

  // TODO: This is perhaps too low-level, consider exposing higher-order abstractions instead, based on usage
  async withTmpGitIndex<R>(fn: (git: SimpleGit) => Promise<R>): Promise<R> {
    return await withTmpDir('withTmpGitIndex-', async (dir: string) => {
      const origGitIndexPath = join(this.fs.projectRootPath, '.git/index');
      const tmpGitIndexPath = join(dir, 'index');

      await copyFile(origGitIndexPath, tmpGitIndexPath);

      return await fn(this.git.env({ ...process.env, GIT_INDEX_FILE: tmpGitIndexPath }));
    });
  }

  async matchProjectFilenames(pattern: string | string[]): Promise<ProjectFilenamesContext> {
    if (!Array.isArray(pattern)) {
      pattern = [pattern];
    }

    const matchers = pattern.map((p) => minimatch.filter(p));

    return ProjectFilenamesContext(this.fs.files.filter((f) => matchers.some((m) => m(f.rpath))));
  }

  async matchProjectDirnames(pattern: string | string[]): Promise<ProjectDirnamesContext> {
    if (!Array.isArray(pattern)) {
      pattern = [pattern];
    }

    const matchers = pattern.map((p) => minimatch.filter(p));

    return ProjectDirnamesContext(this.fs.dirs.filter((f) => matchers.some((m) => m(f.rpath))));
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
