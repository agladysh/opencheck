import type { ProjectFilenamesContext, ProjectFilesContext } from './Context.ts';

export interface Runtime {
  matchProjectFilenames: (pattern: string | string[]) => Promise<ProjectFilenamesContext>;
  readMatchingProjectFiles: (pattern: string | string[]) => Promise<ProjectFilesContext>;
}
