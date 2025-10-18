import { type Brand, make } from 'ts-brand';
import type { Runtime } from './Runtime.ts';
import type { SkipVerdict, Verdict } from './Verdict.ts';
import { type Context, type ContextFactory, ContextTypeFromFactory } from './Context.ts';

export type RuleID = Brand<string, 'OpenCheck.RuleID'>;
export const RuleID = make<RuleID>();

export interface ContextRef<C extends Context = Context> {
  readonly type: C['type'];
  readonly id: string;
}
export const ContextRef = <F extends ContextFactory>(
  factory: F,
  id: string
): ContextRef<ContextTypeFromFactory<F>> => ({
  type: ContextTypeFromFactory(factory),
  id: id,
});

export type ContextTypeFromRef<T> = T extends ContextRef<infer C> ? C : never;

export type ContextMap = Record<PropertyKey, ContextRef>;

export type RuntimeContext<M extends ContextMap> = {
  [k in keyof M]: ContextTypeFromRef<M[k]>;
};

export interface Rule<M extends ContextMap> {
  readonly id: RuleID;
  readonly context: M;

  when: (context: RuntimeContext<M>, runtime: Runtime) => Promise<true | SkipVerdict>;
  run: (context: RuntimeContext<M>, runtime: Runtime) => Promise<Verdict>;
}
