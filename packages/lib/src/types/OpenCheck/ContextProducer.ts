import { type Brand, make } from 'ts-brand';
import type { Runtime } from './Runtime.ts';

export type ContextID = Brand<string, 'OpenCheck.ContextID'>;
export const ContextID = make<ContextID>();

interface Meta {
  readonly id: ContextID; // TODO: Do we need this?
}

type Run<T> = (runtime: Runtime) => Promise<T>;

export type ContextProducer<T = unknown> = Meta & { run: Run<T> };
export type ContextProducerResult<T> = T extends ContextProducer<infer U> ? U : never;
export const ContextProducer = <T>(meta: Meta, run: Run<T>): ContextProducer<T> => {
  return { ...meta, run };
};
