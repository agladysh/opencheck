import type { FileSystem, Filter } from './FileSystem.ts';

export function formatFiles(fs: FileSystem, omitter: Filter) {
  return fs.files
    .filter((f) => !omitter(f.rpath))
    .map((f) => `<file rpath="${f.rpath}">${fs.readFile(f)}</file>`)
    .join('');
}
