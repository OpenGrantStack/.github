# GrantReady Hub

Enterprise-grade mobile collaboration platform for grant management teams.

## Overview

GrantReady Hub is a centralized SaaS service designed for government agencies, educational institutions, and compliance-driven organizations managing grant programs. The platform enables secure collaboration, approval workflows, and activity tracking across distributed teams.

## Key Features

### 🔐 Role-Based Access Control
Granular permissions system with hierarchical role management designed for multi-agency collaboration.

### 📋 Approval Workflows
Configurable multi-stage approval processes with parallel review, escalation paths, and audit trails.

### 💬 Contextual Collaboration
Threaded comments, @mentions, and file annotations with full version history.

### 📱 Mobile-First Design
Progressive Web App (PWA) with offline capabilities and native mobile application parity.

### 🏛️ Compliance Ready
Built for government security standards including FedRAMP Moderate, GDPR, and HIPAA compliance.

## Architecture

```

┌─────────────────────────────────────────────┐
│Mobile Clients               │
│(PWA, iOS, Android, Desktop)              │
└─────────────────┬───────────────────────────┘
│ HTTPS/WebSocket
┌─────────────────▼───────────────────────────┐
│API Gateway                    │
│(Rate Limiting, Request Validation)       │
└─────────────────┬───────────────────────────┘
│
┌─────────────────▼───────────────────────────┐
│Application Layer                 │
│• User Management                          │
│• Role & Permission Engine                 │
│• Workflow Orchestrator                    │
│• Activity Logger                          │
└─────────────────┬───────────────────────────┘
│
┌─────────────────▼───────────────────────────┐
│Data Layer                     │
│• PostgreSQL (Primary)                     │
│• Redis (Cache & Sessions)                 │
│• Elasticsearch (Activity Search)          │
└─────────────────────────────────────────────┘

```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/grantready/hub.git
cd grantready-hub
```

1. Install dependencies:

```bash
npm install
```

1. Configure environment:

```bash
cp .env.example .env
# Edit .env with your configuration
```

1. Initialize database:

```bash
npx prisma migrate deploy
npm run db:seed
```

1. Start development server:

```bash
npm run dev
```

Docker Deployment

```bash
docker-compose up -d
```

Integration Points

Authentication

· OpenID Connect (OIDC)
· SAML 2.0
· LDAP/Active Directory
· API Key Management

Grant Management Systems

· Grants.gov Web Services
· SAM.gov Entity Management
· Custom grant system webhooks

Document Storage

· AWS S3 (with GovCloud support)
· Azure Blob Storage
· On-premise object storage

Notification Services

· Email (SMTP, SendGrid, Amazon SES)
· SMS (Twilio, Amazon SNS)
· Mobile push notifications

API Documentation

Full API documentation available via OpenAPI 3.0:

```bash
# Start local server with docs
npm run docs:serve
```

Access documentation at: http://localhost:3000/api-docs

Development

Project Structure

```
src/
├── users/          # User management
├── roles/          # RBAC implementation
├── approvals/      # Workflow engine
└── activity/       # Audit logging
```

Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e
```

Deployment

Cloud Platforms

· AWS (GovCloud compatible)
· Azure Government
· Google Cloud Platform
· On-premise private cloud

Infrastructure as Code

Terraform modules available for:

· AWS CloudFormation
· Azure Resource Manager
· Kubernetes Helm Charts

License

This software is available under the GrantReady Hub License Agreement. See LICENSE for details.

For commercial SaaS deployment or government production use, contact licensing@grantready.com.

Support

· Documentation: docs.grantready.com
· Enterprise Support: support@grantready.com
· Security Issues: security@grantready.com
· Community Forum: community.grantready.com

Contributing

Contributions are welcome from authorized partners and customers. Please review CONTRIBUTING.md for guidelines.

---

© 2026 GrantReady, Inc. All rights reserved.
---

## 🧠 Design Principles

We build with the following principles in mind:

- **Open by default**  
  Standards, schemas, and documentation should be inspectable and reusable.

- **Modular, not monolithic**  
  Organizations should adopt what they need without rewriting everything.

- **Audit-first thinking**  
  Compliance and oversight are features, not afterthoughts.

- **Mobile-native**  
  Grant work happens in the real world, not just behind desks.

- **Human accountability**  
  Automation assists — it does not replace human responsibility.

---

## 🔐 Licensing & Usage

OpenGrantStack uses a mix of:
- Apache 2.0 licensed open-source components
- Source-available or commercial licenses for managed services and governance tooling

Each repository clearly states its license and intended usage model.

---

## 🤝 Contributing

We welcome contributors who care about:
- Open infrastructure
- Public-sector technology
- Transparency and accountability
- Real-world impact

See individual repositories for contribution guidelines and code of conduct.

---

## 🚀 Why OpenGrantStack Exists

Grants move billions of dollars every year — yet the systems behind them are often fragmented, opaque, and outdated.

OpenGrantStack exists to change that.

We believe grant infrastructure should be:
- Trustworthy
- Verifiable
- Interoperable
- Built to last

This is infrastructure for the long game.

---

## 📡 Stay Connected

OpenGrantStack is evolving.  
Expect new tools, deeper integrations, and stronger standards over time.

Build openly. Govern transparently. Measure impact.
