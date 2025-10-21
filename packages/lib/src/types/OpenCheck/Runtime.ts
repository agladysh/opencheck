import type { SimpleGit } from 'simple-git';
import { type Brand, make } from 'ts-brand';
import type { ProjectDirnamesContext, ProjectFilenamesContext, ProjectFilesContext } from './Context.ts';

export type GitObjectName = Brand<string, 'OpenCheck.GitObjectName'>;
export const GitObjectName = make<GitObjectName>();

export interface Runtime {
  readonly git: SimpleGit;

  isGitDirty(): Promise<boolean>;
  gitHead(): Promise<GitObjectName>;
  gitDirtyHead(): Promise<GitObjectName>;
  getFirstCommitWithRenames(rpath: string, lastCommit: GitObjectName): Promise<GitObjectName>;
  getFirstCommitWithoutRenames(rpath: string, lastCommit: GitObjectName): Promise<GitObjectName>;
  isFileTrackedInGit(rpath: string): Promise<boolean>;
  gitLogNameStatus(from: string, to: string): Promise<string>;
  gitLogNameStatusSingle(commit: string): Promise<string>;

  withTmpGitIndex<R>(fn: (git: SimpleGit) => Promise<R>): Promise<R>; // Deprecated.

  matchProjectFilenames(pattern: string | string[]): Promise<ProjectFilenamesContext>;
  matchProjectDirnames(pattern: string | string[]): Promise<ProjectDirnamesContext>;
  readMatchingProjectFiles(pattern: string | string[]): Promise<ProjectFilesContext>;
}
