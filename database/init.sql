-- ==============================================================================
-- AyuSakshi (IP-SAKTI Sahayak) - Database Initialization Schema
-- SIH26045: Multilingual RAG Platform for Ayurveda IP & Regulatory Intelligence
-- ==============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ------------------------------------------------------------------------------
-- 1. USERS & ROLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'researcher', 'practitioner', 'msme', 'facilitator', 'admin')),
    auth_provider VARCHAR(50) DEFAULT 'local' CHECK (auth_provider IN ('local', 'google', 'facebook')),
    provider_id VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ------------------------------------------------------------------------------
-- 2. CONVERSATIONS & SESSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Conversation',
    jurisdiction VARCHAR(50) DEFAULT 'india' CHECK (jurisdiction IN ('india', 'international')),
    formulation_state JSONB DEFAULT '{}'::jsonb,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_jurisdiction ON conversations(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- ------------------------------------------------------------------------------
-- 3. MESSAGES (CONVERSATIONAL STREAM & RAG TRACE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    thinking_trace JSONB DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(5, 4) DEFAULT 0.0000,
    confidence_level VARCHAR(20) DEFAULT 'high' CHECK (confidence_level IN ('high', 'medium', 'low', 'abstained')),
    citations JSONB DEFAULT '[]'::jsonb,
    ip_domains TEXT[] DEFAULT ARRAY[]::TEXT[],
    classification JSONB DEFAULT NULL,
    abs_summary JSONB DEFAULT NULL,
    tkdl_summary JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);

-- ------------------------------------------------------------------------------
-- 4. AUTHORITATIVE KNOWLEDGE CORPUS & VERSIONING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    authority VARCHAR(255) NOT NULL, -- e.g. 'Indian Patent Office', 'National Biodiversity Authority', 'WIPO'
    document_type VARCHAR(100) NOT NULL, -- 'statute', 'rule', 'treaty', 'pharmacopoeia', 'guideline', 'case_law'
    jurisdiction VARCHAR(50) NOT NULL CHECK (jurisdiction IN ('india', 'international')),
    category VARCHAR(100) NOT NULL, -- 'patents', 'trademarks', 'gi', 'designs', 'copyright', 'biodiversity', 'ayush', 'fssai', 'treaties'
    source_url TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'superseded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_jurisdiction ON documents(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_tag VARCHAR(100) NOT NULL, -- e.g. '1970-Consolidated-2024', '2024-Rules'
    effective_date DATE,
    content_hash VARCHAR(128) NOT NULL,
    is_current BOOLEAN DEFAULT TRUE,
    file_path TEXT,
    raw_text_length INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_current ON document_versions(is_current);

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    section_identifier VARCHAR(255), -- e.g. 'Section 3(p)', 'Rule 157', 'Article 27(3)(b)'
    title VARCHAR(500),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    tsv_content TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(section_identifier, '') || ' ' || coalesce(title, '') || ' ' || content)) STORED,
    embedding VECTOR(384), -- 384 dimensions for all-MiniLM / multilingual-MiniLM
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_version_id ON document_chunks(document_version_id);
CREATE INDEX IF NOT EXISTS idx_chunks_section ON document_chunks(section_identifier);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON document_chunks USING GIN(tsv_content);

-- Vector index for fast cosine distance search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_cosine ON document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ------------------------------------------------------------------------------
-- 5. CITATION AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    claim_text TEXT NOT NULL,
    source_title VARCHAR(500) NOT NULL,
    section_reference VARCHAR(255),
    jurisdiction VARCHAR(50) NOT NULL,
    verified_grounded BOOLEAN DEFAULT TRUE,
    similarity_score NUMERIC(5, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_citations_message_id ON citations(message_id);

-- ------------------------------------------------------------------------------
-- 6. FORMULATION CLASSIFICATIONS & AUDIT
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formulation_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    raw_input TEXT NOT NULL,
    identified_category VARCHAR(100) NOT NULL, -- 'Classical Medicine', 'Patent or Proprietary', 'Phytopharmaceutical', etc.
    reasoning TEXT,
    ip_posture JSONB DEFAULT '{}'::jsonb,
    abs_relevant BOOLEAN DEFAULT FALSE,
    regulatory_pathway JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_formulations_conv_id ON formulation_classifications(conversation_id);

-- ------------------------------------------------------------------------------
-- 7. HUMAN IP FACILITATOR ESCALATION WORKSPACE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS human_review_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    question TEXT NOT NULL,
    jurisdiction VARCHAR(50) DEFAULT 'india',
    formulation_summary TEXT,
    retrieved_evidence JSONB DEFAULT '[]'::jsonb,
    system_confidence NUMERIC(5, 4),
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_REVIEW', 'RESOLVED', 'CLOSED')),
    resolution_notes TEXT,
    facilitator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_human_reviews_status ON human_review_requests(status);
CREATE INDEX IF NOT EXISTS idx_human_reviews_user_id ON human_review_requests(user_id);

-- ------------------------------------------------------------------------------
-- 8. RELATIONAL KNOWLEDGE GRAPH
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(100) NOT NULL, -- 'statute', 'section', 'ingredient', 'formulation_type', 'treaty', 'authority'
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(255) UNIQUE NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON knowledge_graph_nodes(entity_type);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_identifier ON knowledge_graph_nodes(identifier);

CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_node_id UUID NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
    relation_type VARCHAR(100) NOT NULL, -- 'governed_by', 'exempts', 'requires_abs', 'cites', 'applies_to', 'contains_prior_art'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON knowledge_graph_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON knowledge_graph_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_rel ON knowledge_graph_edges(relation_type);

-- ------------------------------------------------------------------------------
-- 9. SYSTEM AUDIT LOGS & EXTERNAL PERMISSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS external_source_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_name VARCHAR(255) NOT NULL,
    permission_granted BOOLEAN DEFAULT FALSE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ------------------------------------------------------------------------------
-- SEED ESSENTIAL ROLES / DEFAULT ADMIN USER
-- Password for both accounts: Ayurveda@2026
-- The previous hash here did not match that password, so neither seeded
-- account could log in and the facilitator queue and admin knowledge base
-- were both unreachable. Regenerated with bcryptjs cost 10 and verified.
-- ------------------------------------------------------------------------------
INSERT INTO users (id, email, password_hash, name, role)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin@ayusakshi.gov.in', '$2a$10$jTK9YI1i7VGerSBPrWT8sexapz2nW7e/lUdckHHMS8bMBwKTz9GWC', 'System Administrator', 'admin'),
    ('00000000-0000-0000-0000-000000000002', 'facilitator@ayusakshi.gov.in', '$2a$10$jTK9YI1i7VGerSBPrWT8sexapz2nW7e/lUdckHHMS8bMBwKTz9GWC', 'Senior IP Facilitator', 'facilitator')
ON CONFLICT (email) DO NOTHING;
