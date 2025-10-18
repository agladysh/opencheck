// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Transparent utility type
type MakeContext<Type extends string, Value> = {
  readonly type: Type;
  readonly value: Value;
};

const contextFactoryTypeKey = Symbol('OpenCheck.ContextFactoryType');

const MakeContext = <T extends Context>(type: T['type']) =>
  Object.assign((value: T['value']) => ({ type, value }) as T, { [contextFactoryTypeKey]: type });

export type FlagContext = MakeContext<'opencheck.flag', boolean>;
export const FlagContext = MakeContext<FlagContext>('opencheck.flag');

export type ProjectFilenamesContext = MakeContext<'opencheck.project.filenames', string[]>;
export const ProjectFilenamesContext = MakeContext<ProjectFilenamesContext>('opencheck.project.filenames');

export interface ProjectFile {
  readonly rpath: string;
  readonly value: string;
}

export type ProjectFileContext = MakeContext<'opencheck.project.file', ProjectFile>;
export const ProjectFileContext = MakeContext<ProjectFileContext>('opencheck.project.file');

export type ProjectFilesContext = MakeContext<'opencheck.project.files', ProjectFileContext[]>;
export const ProjectFilesContext = MakeContext<ProjectFilesContext>('opencheck.project.files');

export type Context = FlagContext | ProjectFilenamesContext | ProjectFileContext | ProjectFilesContext;
export type ContextFactory = Context extends infer C
  ? C extends Context
    ? ReturnType<typeof MakeContext<C>>
    : never
  : never;

export type ContextTypeFromFactory<F> = F extends ReturnType<typeof MakeContext<infer T extends Context>> ? T : never;
export const ContextTypeFromFactory = <F extends ContextFactory>(factory: F) => factory[contextFactoryTypeKey];
