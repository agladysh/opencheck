// TODO: Move to types/OneOf.ts

export type OneOf<T> = T extends readonly [...unknown[]] ? T[keyof T] : never;
