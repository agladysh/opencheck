import tasksCompleted from './rules/consistency/archived/tasks-completed.ts';
import hasOpenSpecDir from './context/has-openspec-dir.ts';
import archived from './context/tasks/archived.ts';

export const rules = [tasksCompleted] as const;

export const contexts = [hasOpenSpecDir, archived] as const;
