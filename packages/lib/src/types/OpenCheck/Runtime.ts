import type { SimpleGit } from 'simple-git';
import type { ProjectDirnamesContext, ProjectFilenamesContext, ProjectFilesContext } from './Context.ts';

export interface Runtime {
  readonly git: SimpleGit;
  matchProjectFilenames(pattern: string | string[]): Promise<ProjectFilenamesContext>;
  matchProjectDirnames(pattern: string | string[]): Promise<ProjectDirnamesContext>;
  readMatchingProjectFiles(pattern: string | string[]): Promise<ProjectFilesContext>;
}
