export function changeIdFromPath(path: string): string {
  return (/archive\/\d\d\d\d-\d\d-\d\d-([^/]*?)\/.*$/.exec(path) ?? [])[1] ?? '(unknown)';
}
