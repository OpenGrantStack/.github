export * from './types';
export * from './service';
export * from './middleware';

import { AuthService } from './service';
import { authMiddleware, requireRole } from './middleware';

export const auth = {
  service: AuthService,
  middleware: {
    auth: authMiddleware,
    requireRole,
  },
};

export default auth;
