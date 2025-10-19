import type { ProjectDirnamesContext, ProjectFilenamesContext, ProjectFilesContext } from './Context.ts';

export interface Runtime {
  matchProjectFilenames: (pattern: string | string[]) => Promise<ProjectFilenamesContext>;
  matchProjectDirnames: (pattern: string | string[]) => Promise<ProjectDirnamesContext>;
  readMatchingProjectFiles: (pattern: string | string[]) => Promise<ProjectFilesContext>;
}
