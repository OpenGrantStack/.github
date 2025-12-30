# Permissions Model

GrantReady Hub implements a comprehensive Role-Based Access Control (RBAC) system with hierarchical permissions, designed for compliance-driven organizations.

## Overview

The permissions model follows the principle of least privilege, ensuring users only have access to the resources necessary for their roles.

## Core Concepts

### 1. Roles
Roles are collections of permissions assigned to users. Each role has:
- **Name**: Unique identifier
- **Description**: Human-readable description
- **Level**: Hierarchical level (0-1000)
- **Permissions**: Array of permission strings
- **System Flag**: Whether role is system-managed

### 2. Permissions
Permissions follow a `resource:action` format:
- `resource`: The entity type (users, roles, approvals, etc.)
- `action`: The operation (read, write, delete, approve, etc.)

Example: `approvals:review`

### 3. Role Assignments
Users can have multiple roles with:
- **Scope**: Optional organizational scope (department, team)
- **Expiration**: Optional assignment expiration date
- **Assigner**: User who made the assignment

## System Roles

GrantReady Hub includes predefined system roles:

### Super Administrator (Level 1000)
- Full system access
- Can manage all resources
- Can assign any role
- System configuration access

### Administrator (Level 900)
- User and role management
- Approval workflow management
- Activity log viewing
- Basic system settings

### Approver (Level 500)
- Review and approve submissions
- Request changes
- Escalate approvals
- View relevant activity

### Viewer (Level 100)
- Read-only access
- View approvals and activity
- No modification rights

## Custom Roles

Organizations can create custom roles with specific permission sets:

```json
{
  "name": "Grant Manager",
  "level": 600,
  "permissions": [
    "users:read",
    "approvals:read",
    "approvals:review",
    "approvals:approve",
    "approvals:reject",
    "activity:read"
  ]
}
```

Permission Hierarchy

Level-Based Hierarchy

Higher-level roles implicitly include permissions from lower-level roles within the same category.

Example:

· Level 600 (Department Head) can override Level 500 (Team Lead) decisions
· Level 900 (Administrator) can manage Level 600 roles

Scope-Based Hierarchy

Role assignments can be scoped to organizational units:

1. Global: No scope restriction
2. Department: Limited to specific department
3. Team: Limited to specific team
4. Project: Limited to specific project

Permission Evaluation

When checking permissions, the system evaluates:

1. Direct Permissions: User's assigned permissions
2. Role Hierarchy: Higher-level role permissions
3. Scope Restrictions: Organizational scope limits
4. Temporal Constraints: Assignment expiration

Permission Categories

User Management

· users:read - View user profiles
· users:write - Create/update users
· users:delete - Delete users
· users:impersonate - Impersonate users (admin only)

Role Management

· roles:read - View roles and assignments
· roles:write - Create/update roles
· roles:delete - Delete roles
· roles:assign - Assign roles to users

Approval Workflows

· approvals:read - View approvals
· approvals:write - Create/update approvals
· approvals:delete - Delete approvals
· approvals:review - Review submissions
· approvals:approve - Approve submissions
· approvals:reject - Reject submissions

Activity Logs

· activity:read - View activity logs
· activity:export - Export activity data

System Settings

· settings:read - View system settings
· settings:write - Modify system settings

Implementation Details

Database Schema

```prisma
model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  level       Int      @default(0)
  isSystem    Boolean  @default(false)
  permissions Json     // Array of permission strings
}

model RoleAssignment {
  userId      String
  roleId      String
  scope       Json?    // Organizational scope
  expiresAt   DateTime?
}
```

Permission Checking

```typescript
// Middleware example
export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const hasPermission = requiredPermissions.every(permission =>
      req.user!.permissions.includes(permission)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

Best Practices

1. Role Design

· Create roles based on job functions, not individuals
· Use descriptive role names
· Document permission sets
· Regularly review and audit roles

2. Assignment Strategy

· Assign multiple specific roles over one broad role
· Use scoping for departmental restrictions
· Set expiration dates for temporary assignments
· Document assignment reasons

3. Security Considerations

· Regular permission audits
· Monitor for permission creep
· Implement approval workflows for role changes
· Log all permission modifications

4. Compliance Requirements

· Maintain audit trails of all permission changes
· Support separation of duties
· Enable role-based access reviews
· Integrate with identity providers

Integration Points

Identity Providers

· SAML 2.0 for enterprise SSO
· OpenID Connect for modern authentication
· LDAP/Active Directory synchronization
· SCIM 2.0 for user provisioning

Governance Tools

· Integration with SIEM systems
· Export for compliance reporting
· Real-time monitoring alerts
· Automated remediation workflows

Examples

Creating a Custom Role

```typescript
const grantOfficerRole = {
  name: "Grant Officer",
  level: 400,
  permissions: [
    "users:read",
    "approvals:read",
    "approvals:review",
    "approvals:approve",
    "approvals:reject",
    "activity:read"
  ]
};
```

Checking Permissions

```typescript
// Controller example
router.post('/approvals/:id/approve',
  requirePermission('approvals:review', 'approvals:approve'),
  async (req, res) => {
    // User has both review and approve permissions
    const result = await approvalService.approve(req.params.id);
    res.json(result);
  }
);
```

Scoped Role Assignment

```typescript
// Assign role with department scope
await roleService.assignRole({
  userId: 'user-123',
  roleId: 'grant-manager-role',
  scope: { department: 'Research' },
  expiresAt: '2024-12-31T23:59:59Z'
});
```

Troubleshooting

Common Issues

1. Permission Denied
   · Check user's assigned roles
   · Verify role permissions
   · Check assignment scope
   · Verify assignment hasn't expired
2. Role Conflicts
   · Review role hierarchy
   · Check for contradictory permissions
   · Verify scope restrictions
3. Performance Issues
   · Limit number of roles per user
   · Use caching for permission checks
   · Regularly clean up expired assignments

Debugging Tools

```typescript
// Get user's effective permissions
const userPermissions = await roleService.getUserPermissions(userId);

// Check specific permission
const canApprove = userPermissions.includes('approvals:approve');

// Get role assignments with details
const assignments = await roleService.getUserRoles(userId);
```

Compliance Notes

The permissions model supports:

· SOC 2: Access control and audit requirements
· HIPAA: Role-based access to PHI
· GDPR: Data access and processing controls
· FedRAMP: Government security standards
· NIST 800-53: Security and privacy controls
