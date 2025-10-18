import { type Brand, make } from 'ts-brand';
import type { Context } from './Context.ts';
import type { Runtime } from './Runtime.ts';

export type ContextID = Brand<string, 'OpenCheck.ContextID'>;
export const ContextID = make<ContextID>();

export interface ContextProducer {
  readonly id: ContextID;

  run: (runtime: Runtime) => Promise<Context>;
}
