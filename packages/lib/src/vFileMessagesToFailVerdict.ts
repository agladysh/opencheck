import type { VFileMessage } from 'vfile-message';
import { FailVerdict } from './types/OpenCheck/Verdict.ts';

export function vFileMessagesToFailVerdict(messages: VFileMessage[]): FailVerdict {
  const result: string[] = messages.map((m) => `${m.file}:${m.line}: ${m.message} (${m.source}:${m.ruleId})`);
  return FailVerdict(result.join('\n'));
}
