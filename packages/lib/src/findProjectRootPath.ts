import { join } from 'path/posix';
import { hasGit } from './git.ts';

export function findProjectRootPath(cwdPath: string): string {
  if (cwdPath === '/') {
    throw new Error('unable to find .git while searching for the project root');
  }

  if (hasGit(cwdPath)) {
    return cwdPath;
  }

  return findProjectRootPath(join(cwdPath, '../'));
}
