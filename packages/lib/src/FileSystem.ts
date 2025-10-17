import { readdirSync, readFileSync } from 'fs';
import { isBinary } from 'istextorbinary';
import { join, relative } from 'path/posix';

interface FSEntryBase {
  readonly path: string;
  readonly rpath: string;
  readonly type: 'file' | 'directory';
}

interface FSEntryDir extends FSEntryBase {
  readonly type: 'directory';
  readonly entries: FSEntry[];
}

interface FSEntryFile extends FSEntryBase {
  readonly type: 'file';
  readonly binary: boolean;
}

export type FSEntry = FSEntryFile | FSEntryDir;

export type Filter = (path: string) => boolean;
export type Walker<T, R> = (state: T, entry: FSEntry, isLast: boolean) => R;

export class FileSystem {
  public readonly projectRootPath: string;
  public readonly root: FSEntryDir;
  public readonly files: FSEntryFile[] = []; // TODO: Remove if unused.

  constructor(projectRootPath: string, ignorer: Filter) {
    this.projectRootPath = projectRootPath;
    this.root = {
      path: this.projectRootPath,
      rpath: './',
      type: 'directory',
      entries: this.scan(this.projectRootPath, ignorer), // Fills this.files as a side-effect.
    };
    this.files.sort((a, b) => a.rpath.localeCompare(b.rpath));
  }

  readFile(entry: FSEntryFile): string {
    if (entry.binary) {
      return '(binary)';
    }
    return readFileSync(entry.path, 'utf-8');
  }

  walk<T = undefined>(state: T, down: Walker<T, undefined | 'break'>, up: Walker<T, void>): T {
    return this.walkImpl(state, down, up, this.root, true);
  }

  private walkImpl<T = undefined>(
    state: T,
    down: Walker<T, undefined | 'break'>,
    up: Walker<T, void>,
    root: FSEntryDir,
    isLast: boolean
  ): T {
    if (down(state, root, isLast) === 'break') {
      return state;
    }

    for (let i = 0; i < root.entries.length; ++i) {
      const entry = root.entries[i];
      const lastEntry = i === root.entries.length - 1;
      if (entry.type === 'directory') {
        this.walkImpl(state, down, up, entry, lastEntry);
        continue;
      }

      if (down(state, entry, lastEntry) === 'break') {
        continue;
      }

      up(state, entry, lastEntry);
    }

    up(state, root, isLast);

    return state;
  }

  private scan(root: string, ignorer: Filter): FSEntry[] {
    const entries = readdirSync(root, { withFileTypes: true });
    const result: FSEntry[] = [];

    for (const entry of entries) {
      const path = join(entry.parentPath, entry.name);

      const rpath = `${relative(this.projectRootPath, path)}${entry.isDirectory() ? '/' : ''}`;
      if (ignorer(rpath)) {
        continue;
      }

      // TODO: Make sure symlinks are handled properly with this logic.
      if (entry.isDirectory()) {
        result.push({
          path,
          rpath,
          type: 'directory',
          entries: this.scan(path, ignorer),
        } satisfies FSEntryDir);
        continue;
      }

      const file: FSEntryFile = {
        path,
        rpath,
        type: 'file',
        binary: !!isBinary(path),
      };

      result.push(file);
      this.files.push(file);
    }

    // Directories are guaranteed to go before files
    result.sort((a, b) => a.type.localeCompare(b.type) || a.rpath.localeCompare(b.rpath));

    return result;
  }
}
