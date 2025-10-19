import tasksCompleted from './rules/consistency/archived/tasks-completed.ts';
import changesImplemented from './rules/consistency/archived/changes-implemented.ts';

import hasOpenSpecDir from './context/has-openspec-dir.ts';
import project from './context/project.ts';
import specs from './context/specs.ts';
import tasksArchived from './context/tasks/archived.ts';
import changesArchived from './context/changes/archived.ts';

export const rules = [tasksCompleted, changesImplemented] as const;

export const contexts = [hasOpenSpecDir, project, specs, tasksArchived, changesArchived] as const;
