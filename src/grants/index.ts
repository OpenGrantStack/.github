export * from './models';
export * from './service';
export * from './validation';

import { GrantService } from './service';
import { validateGrantApplication, validateGrantCreation } from './validation';

export const grants = {
  service: GrantService,
  validation: {
    grantApplication: validateGrantApplication,
    grantCreation: validateGrantCreation,
  },
};

export default grants;
