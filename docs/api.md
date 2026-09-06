# REST API Specification — AyuSakshi

## 1. Authentication Endpoints
- `POST /api/auth/register`: Register user with Name, Email, Password, and Role (`user`, `researcher`, `practitioner`, `msme`, `facilitator`).
- `POST /api/auth/login`: Authenticate with email & password, returns JWT token.
- `GET /api/auth/profile`: Get current authenticated user profile (`Bearer <JWT>`).
- `POST /api/auth/social`: Social OAuth login (Google / Facebook).
- `GET /api/auth/google`: Google OAuth 2.0 redirect endpoint.
- `GET /api/auth/facebook`: Facebook OAuth redirect endpoint.

## 2. Conversational RAG Endpoints
- `GET /api/chat/conversations?jurisdiction=india`: List conversations filtered by active jurisdiction.
- `POST /api/chat/conversations`: Create a new conversation session.
- `GET /api/chat/conversations/:id`: Get full message history and thinking traces for a conversation.
- `POST /api/chat/conversations/:id/messages`: Send user query, execute multi-step RAG, and receive grounded response with citations.
- `DELETE /api/chat/conversations/:id`: Archive a conversation.

## 3. Specialized Tools & Facilitator Endpoints
- `POST /api/formulations/classify`: Classify formulation into 6 regulatory classes.
- `POST /api/escalations`: Submit human review ticket to accredited AYUSH IP Facilitators.
- `GET /api/escalations`: List escalated tickets (Facilitator/Admin only).
- `PATCH /api/escalations/:id`: Update ticket status (`PENDING`, `IN_REVIEW`, `RESOLVED`, `CLOSED`) and save guidance notes.

## 4. Knowledge Corpus Management Endpoints
- `GET /api/documents`: List indexed statutory acts, rules, and treaties.
- `GET /api/documents/:id`: Inspect document versions and indexed chunks.
- `POST /api/documents/upload`: Upload PDF source document and trigger background vectorization.

## 5. System Health
- `GET /health`: Comprehensive health diagnostics for Node API, PostgreSQL, Redis, and Python AI Service.
