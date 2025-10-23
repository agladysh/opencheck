import { type Brand, make } from 'ts-brand';
import type { Runtime } from './Runtime.ts';
import type { SkipVerdict, Verdict } from './Verdict.ts';
import type { ContextProducer, ContextProducerResult } from './ContextProducer.ts';

export type RuleID = Brand<string, 'OpenCheck.RuleID'>;
export const RuleID = make<RuleID>();

export type IsContextProducerMap<M> = M extends Record<keyof M, ContextProducer> ? M : never;

export type RuntimeContext<M> = {
  [k in keyof M]: ContextProducerResult<M[k]>;
};

interface Meta<M> {
  readonly id: RuleID;
  readonly context: IsContextProducerMap<M>;
}

type When<M> = (context: RuntimeContext<M>, runtime: Runtime) => Promise<true | SkipVerdict>;
type Run<M> = (context: RuntimeContext<M>, runtime: Runtime) => Promise<Verdict>;

export type Rule<M = object> = Meta<M> & { when: When<M>; run: Run<M> };
export const Rule = <M>(meta: Meta<M>, when: When<M>, run: Run<M>): Rule<M> => ({ ...meta, when, run });
export type RuleRuntimeContext<T> = T extends Rule<infer M> ? M : never;
