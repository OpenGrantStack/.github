export * from './engine';
export * from './templates';
export * from './tasks';

import { WorkflowEngine } from './engine';
import { getTemplate, registerTemplate } from './templates';
import { TaskService } from './tasks';

export const workflows = {
  engine: WorkflowEngine,
  templates: {
    get: getTemplate,
    register: registerTemplate,
  },
  tasks: TaskService,
};

export default workflows;
