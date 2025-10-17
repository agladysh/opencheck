import { basename } from 'path/posix';
import type { FSEntry, FileSystem, Filter } from './FileSystem.ts';

interface DirtreeState {
  lines: string[];
  prefix: string[];
  omitter: Filter;
}

function dirtreeDown(state: DirtreeState, entry: FSEntry, isLast: boolean): undefined | 'break' {
  if (entry.rpath === './') {
    state.lines.push('./');
    return;
  }

  const omit = state.omitter(entry.rpath);
  const name = `${basename(entry.rpath)}${entry.type === 'directory' ? '/' : ''}`;

  let annotation = entry.type === 'file' && entry.binary ? ' [binary]' : '';
  if (omit) {
    annotation = ' [omitted]';
  }

  const branch = isLast ? '└─ ' : '├─ ';

  state.lines.push(`${state.prefix.join('')}${branch}${name}${annotation}`);

  if (omit) {
    return 'break'; // Prevent subtree traversal
  }

  state.prefix.push(isLast ? '   ' : '│  ');
}

function dirtreeUp(state: DirtreeState, _entry: FSEntry, _isLast: boolean) {
  state.prefix.pop();
}

export function renderDirtree(fs: FileSystem, omitter: Filter): string {
  const state: DirtreeState = {
    lines: [],
    prefix: [''],
    omitter,
  };
  return fs.walk(state, dirtreeDown, dirtreeUp).lines.join('\n');
}
