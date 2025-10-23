import tasksCompleted from './rules/consistency/archived/tasks-completed.ts';
import changesImplemented from './rules/consistency/archived/changes-implemented.ts';

export const rules = [tasksCompleted, changesImplemented] as const;
