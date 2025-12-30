grantready-hub/
├── LICENSE
├── SECURITY.md
├── README.md
├── package.json
├── tsconfig.json
├── .gitignore
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── api/
│   └── openapi.yaml
├── docs/
│   ├── permissions-model.md
│   └── workflow-engine.md
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── database.ts
│   │   └── middleware.ts
│   ├── types/
│   │   ├── index.ts
│   │   └── api.ts
│   ├── middleware/
│   │   └── auth.ts
│   ├── users/
│   │   ├── service.ts
│   │   ├── controller.ts
│   │   └── types.ts
│   ├── roles/
│   │   ├── service.ts
│   │   ├── controller.ts
│   │   └── types.ts
│   ├── approvals/
│   │   ├── service.ts
│   │   ├── controller.ts
│   │   ├── types.ts
│   │   └── workflows.ts
│   └── activity/
│       ├── service.ts
│       ├── controller.ts
│       └── types.ts
├── prisma/
│   └── schema.prisma
├── tests/
│   ├── unit/
│   │   └── roles.test.ts
│   └── integration/
│       └── approvals.test.ts
└── scripts/
    └── init-db.ts
