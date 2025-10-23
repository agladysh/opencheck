import type { ArkErrors, JsonSchema } from '@ark/schema';
import type { Type } from 'arktype';
import type { SimpleGit } from 'simple-git';
import { type Brand, make } from 'ts-brand';
import type { FSEntryDir, FSEntryFile } from '../../FileSystem.ts';
import type { JsonObject } from '../json.ts';
import type { OneOf } from '../OneOf.ts';
import type { ContextProducer, ContextProducerResult } from './ContextProducer.ts';
import type { IsContextProducerMap, RuntimeContext } from './Rule.ts';

// TODO: Move closer to FileSystem.ts?
export interface ProjectFile {
  readonly entry: FSEntryFile;
  readonly value: string; // TODO: Perhaps, VFile?
}

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

  matchProjectFilenames(pattern: string | string[]): Promise<FSEntryFile[]>;
  matchProjectDirnames(pattern: string | string[]): Promise<FSEntryDir[]>;
  readMatchingProjectFiles(pattern: string | string[]): Promise<ProjectFile[]>;
  readFile(entry: FSEntryFile): Promise<ProjectFile>;

  resolveContextMap<M>(map: IsContextProducerMap<M>): Promise<RuntimeContext<M>>;
  runContextProducer<P extends ContextProducer>(producer: P): Promise<ContextProducerResult<P>>;

  aiSelect<T extends AISelectOptions>(request: AISelectRequest<T>): Promise<AISelectOptionType<OneOf<T>>>;
}
