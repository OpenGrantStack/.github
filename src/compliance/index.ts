export * from './audit';
export * from './checks';
export * from './standards';

import { ComplianceService } from './checks';
import { AuditService } from './audit';
import { STANDARDS } from './standards';

export const compliance = {
  service: ComplianceService,
  audit: AuditService,
  standards: STANDARDS,
};

export default compliance;
