import { existsSync, readFileSync } from 'fs';
import { join } from 'path/posix';

export function hasGit(path: string): boolean {
  return existsSync(join(path, '.git'));
}

export function readGitIgnore(projectRootPath: string) {
  // TODO: Strictly speaking, Git may have more ignores configured.
  const path = join(projectRootPath, '.gitignore');
  if (!existsSync(path)) {
    return '';
  }
  return readFileSync(path, 'utf-8');
}
