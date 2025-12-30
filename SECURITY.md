# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Security updates |
| < 1.0   | ❌ End of life     |

## Reporting a Vulnerability

GrantReady Hub follows a coordinated vulnerability disclosure process.

### Reporting Process

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security disclosures to: security@grantready.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if known)

### Response Timeline

- **24 hours**: Initial acknowledgment
- **72 hours**: Preliminary assessment
- **7 days**: Update on remediation progress
- **30 days**: Public disclosure (unless critical infrastructure impact)

### Security Features

#### Data Protection
- All data encrypted at rest (AES-256)
- TLS 1.3 for data in transit
- Field-level encryption for PII
- Automatic key rotation every 90 days

#### Access Control
- Role-based access control (RBAC)
- Multi-factor authentication (MFA) support
- Session management with automatic timeout
- IP allowlisting capabilities

#### Compliance
- Audit logging for all administrative actions
- Data retention policies configurable per jurisdiction
- GDPR-ready data subject request processing
- HIPAA BAA available for healthcare organizations

#### Infrastructure Security
- Container image scanning
- Dependency vulnerability scanning (weekly)
- Static code analysis in CI/CD pipeline
- Secrets management via HashiCorp Vault or AWS Secrets Manager

### Security Best Practices for Deployment

1. **Network Security**
   - Deploy within private VPC/subnet
   - Use security groups/NSGs to restrict access
   - Implement WAF for public endpoints

2. **Identity Management**
   - Integrate with enterprise SSO (SAML 2.0, OIDC)
   - Enforce strong password policies
   - Implement conditional access policies

3. **Monitoring**
   - Enable audit trails for all data access
   - Monitor for anomalous behavior
   - Regular security log review

### Security Updates

Security patches are released monthly on the second Tuesday. Critical vulnerabilities are patched within 72 hours of confirmation.

### Third-Party Security

All dependencies are:
- Scanned for known vulnerabilities
- Pinned to specific versions
- Reviewed for license compliance
- Monitored for security advisories

### Contact

For security-related inquiries: security@grantready.com  
PGP Key: Available upon request for encrypted communication
