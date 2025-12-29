

```typescript
// Generated from JSON Schema
export interface Grant {
  metadata: GrantMetadata;
  grantId: string;
  grantNumber: string;
  grantTitle: string;
  // ... other properties
}

// Use with validation
const validateGrant = (data: unknown): Grant => {
  // Validation logic
  return data as Grant;
};
