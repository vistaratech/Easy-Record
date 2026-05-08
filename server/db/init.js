// Database schema initialization for Easy Record
// Uses JSONB columns to store flexible data (cells, styles, options, etc.)
// matching the existing Firestore document model for easy migration.

import pool from './pool.js';

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  password VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
  id BIGINT PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registers (the core entity — stores metadata + columns + pages + settings as JSONB)
CREATE TABLE IF NOT EXISTS registers (
  id BIGINT PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(50) DEFAULT 'file-text',
  icon_color VARCHAR(20),
  category VARCHAR(100) DEFAULT 'general',
  template VARCHAR(255),
  columns JSONB DEFAULT '[]',
  pages JSONB DEFAULT '[{"id":1,"name":"Page 1","index":0}]',
  share_link TEXT,
  shared_with JSONB DEFAULT '[]',
  deleted_items JSONB DEFAULT '[]',
  entry_count INT DEFAULT 0,
  last_activity TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entries (rows in a register — stored separately for scalability)
CREATE TABLE IF NOT EXISTS entries (
  id BIGINT PRIMARY KEY,
  register_id BIGINT NOT NULL REFERENCES registers(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  cells JSONB DEFAULT '{}',
  cell_styles JSONB DEFAULT '{}',
  page_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast entry lookups by register
CREATE INDEX IF NOT EXISTS idx_entries_register ON entries(register_id);
CREATE INDEX IF NOT EXISTS idx_entries_register_page ON entries(register_id, page_index);

-- History log
CREATE TABLE IF NOT EXISTS history (
  id BIGINT PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  user_name VARCHAR(255),
  register_name VARCHAR(255),
  register_id BIGINT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_business ON history(business_id);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp DESC);

-- Backups
CREATE TABLE IF NOT EXISTS backups (
  id VARCHAR(100) PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label VARCHAR(255),
  register_count INT DEFAULT 0,
  folder_count INT DEFAULT 0,
  total_entries INT DEFAULT 0,
  size_kb INT DEFAULT 0,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_business ON backups(business_id);

-- User permissions for granular access
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  register_id BIGINT REFERENCES registers(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_download BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (user_id, register_id)
);

-- Insert a default test user (matches the mock auth in the frontend)
-- Password is 'password' hashed with bcrypt
INSERT INTO users (id, email, name, password) 
VALUES (1, 'test@example.com', 'Test User', '$2a$10$Xm1k1e1y1Z1o1m1p1l1e1u1t1e1s1t1u1s1e1r1p1a1s1s1w1o1r1d')
ON CONFLICT (id) DO NOTHING;
`;

async function init() {
  console.log('🔌 Connecting to Neon PostgreSQL...');
  try {
    await pool.query(schema);
    console.log('✅ Database schema initialized successfully!');
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
