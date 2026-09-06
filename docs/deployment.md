# Deployment & Production Runbook

## Docker Multi-Service Cluster

### Services Overview
- `frontend`: Nginx alpine hosting optimized React + Tailwind CSS client (`:5173` mapped to `:80`)
- `backend`: Node.js Express Application Backend (`:5000`)
- `ai-service`: Python FastAPI AI / RAG Engine (`:8000`)
- `postgres`: PostgreSQL 16 with pgvector extension (`:5432`)
- `redis`: Redis 7 Alpine cache and BullMQ job broker (`:6379`)

### Commands
```bash
# Start all containers in background
docker-compose up -d --build

# Inspect logs
docker-compose logs -f

# Check health of services
docker-compose ps
```
