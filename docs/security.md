# Security & Compliance Architecture

## 1. Threat Modeling & Safeguards
- **RAG Prompt Injection Defense**: Retrieved legal documents are treated purely as **data**, never executable instructions.
- **Isolated AI Network**: Python FastAPI service is not exposed to the public internet; only the Node.js Express backend communicates with it via token authentication (`x-ai-service-token`).
- **Authentication & RBAC**: Stateless JWT tokens with salted bcrypt password hashing and Role-Based Access Control (`user`, `researcher`, `msme`, `facilitator`, `admin`).
- **Rate Limiting**: Redis-backed / sliding window rate limiting on chat, upload, and authentication routes.
- **Input Validation**: Strict schema validation and file size limits (50MB) on PDF uploads.
- **Audit Logging**: Comprehensive action logs stored in PostgreSQL table `audit_logs` tracking IP addresses, endpoints, and timestamps for Digital Personal Data Protection (DPDP) alignment.
