export interface PassVerdict {
  readonly status: 'pass';
}
export const PassVerdict = (): PassVerdict => ({ status: 'pass' });

export interface SkipVerdict {
  readonly status: 'skip';
  readonly message: string;
}
export const SkipVerdict = (message: string): SkipVerdict => ({ status: 'skip', message });

export interface FailVerdict {
  readonly status: 'fail';
  readonly message: string;
}
export const FailVerdict = (message: string): FailVerdict => ({ status: 'fail', message });

export type Verdict = PassVerdict | SkipVerdict | FailVerdict;
