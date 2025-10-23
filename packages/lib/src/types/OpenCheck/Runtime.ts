import type { ArkErrors, JsonSchema } from '@ark/schema';
import type { Type } from 'arktype';
import type { SimpleGit } from 'simple-git';
import { type Brand, make } from 'ts-brand';
import type { JsonObject } from '../json.ts';
import type { ProjectDirnamesContext, ProjectFilenamesContext, ProjectFilesContext } from './Context.ts';

// TODO: Move this stuff to Git typings file
export type GitObjectName = Brand<string, 'OpenCheck.GitObjectName'>;
export const GitObjectName = make<GitObjectName>();

// TODO: Move this stuff to AI typings file
export interface AISelectOption<T extends JsonObject = JsonObject> {
  jsonSchema: JsonSchema;
  validate(value: unknown): T | ArkErrors;
}
const AISelectOption = <T extends Type>(t: T) => ({ validate: t, jsonSchema: t.toJsonSchema() });

export type AISelectOptionType<T> = T extends AISelectOption<infer U> ? U : never;

export type AISelectOptions = readonly [AISelectOption, ...AISelectOption[]];

export interface AISelectRequest<T extends AISelectOptions> {
  readonly system: string;
  readonly user: string;
  readonly options: T;
}

// TODO: Move to types/OneOf.ts
export type OneOf<T> = T extends readonly [...unknown[]] ? T[keyof T] : never;

// TODO: Move Git stuff to a separate object? GitRuntime, FSRuntime, AIRuntime?
export interface Runtime {
  // TODO: Weird, both SimpleGit and ad-hoc functions are a bit redundant
  //       SimpleGit is needed to avoid parsing, ad-hoc functions needed to avoid reconstructing git output from parsed data
  readonly git: SimpleGit;

  isGitDirty(): Promise<boolean>;
  gitHead(): Promise<GitObjectName>;
  gitDirtyHead(): Promise<GitObjectName>;
  getFirstCommitWithRenames(rpath: string, lastCommit: GitObjectName): Promise<GitObjectName>;
  getFirstCommitWithoutRenames(rpath: string, lastCommit: GitObjectName): Promise<GitObjectName>;
  isFileTrackedInGit(rpath: string): Promise<boolean>;
  gitLogNameStatus(from: string, to: string): Promise<string>;
  gitLogNameStatusSingle(commit: string): Promise<string>;

  withTmpGitIndex<R>(fn: (git: SimpleGit) => Promise<R>): Promise<R>; // Deprecated (too low-level).

  matchProjectFilenames(pattern: string | string[]): Promise<ProjectFilenamesContext>;
  matchProjectDirnames(pattern: string | string[]): Promise<ProjectDirnamesContext>;
  readMatchingProjectFiles(pattern: string | string[]): Promise<ProjectFilesContext>;

  aiSelect<T extends AISelectOptions>(request: AISelectRequest<T>): Promise<AISelectOptionType<OneOf<T>>>;
}
