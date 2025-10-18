export interface PassVerdict {
  readonly status: 'pass';
}

export interface SkipVerdict {
  readonly status: 'skip';
  readonly message: string;
}

export interface FailVerdict {
  readonly status: 'fail';
  readonly message: string;
}

export type Verdict = PassVerdict | SkipVerdict | FailVerdict;
