import pg from 'pg';
import { seedDatabase } from './seed.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://tcms:tcms_password@db:5432/tcms',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      role VARCHAR(50) NOT NULL,
      department VARCHAR(100),
      avatar VARCHAR(255),
      active BOOLEAN DEFAULT TRUE,
      sso_provider VARCHAR(50) DEFAULT 'local',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      key_code VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      status VARCHAR(50) DEFAULT 'Active',
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS requirements (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) DEFAULT 'Draft',
      priority VARCHAR(50) DEFAULT 'Medium',
      source VARCHAR(50) DEFAULT 'Business',
      user_story TEXT,
      acceptance_criteria TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS requirement_documents (
      id SERIAL PRIMARY KEY,
      requirement_id INTEGER REFERENCES requirements(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id),
      file_name VARCHAR(500) NOT NULL,
      file_path VARCHAR(1000),
      file_size INTEGER,
      extracted_text TEXT,
      rag_chunks TEXT,
      user_story_breakdown TEXT,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      code VARCHAR(100) NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      status VARCHAR(50) DEFAULT 'Draft',
      severity VARCHAR(50) DEFAULT 'Medium',
      priority VARCHAR(50) DEFAULT 'Medium',
      assignee_id INTEGER REFERENCES users(id),
      creator_id INTEGER REFERENCES users(id),
      steps TEXT,
      expected_result TEXT,
      actual_result TEXT,
      tags TEXT,
      modul_fitur VARCHAR(500),
      user_story_coverage TEXT,
      tipe_test VARCHAR(200),
      user_role VARCHAR(200),
      tujuan_pengujian TEXT,
      langkah_uji TEXT,
      validasi_data_uji TEXT,
      hasil_yang_diharapkan TEXT,
      pic_qa VARCHAR(255),
      status_sit VARCHAR(100),
      date_sit_executed DATE,
      date_sit_done DATE,
      object_test_version VARCHAR(100),
      api_version VARCHAR(100),
      test_scenario_version VARCHAR(100),
      requirement_id INTEGER REFERENCES requirements(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS test_runs (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      name VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'Planned',
      created_by INTEGER REFERENCES users(id),
      planned_start TIMESTAMPTZ,
      actual_end TIMESTAMPTZ,
      summary TEXT,
      estimated_minutes INTEGER,
      actual_minutes INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS test_run_results (
      id SERIAL PRIMARY KEY,
      run_id INTEGER REFERENCES test_runs(id) ON DELETE CASCADE,
      test_case_id INTEGER REFERENCES test_cases(id) ON DELETE CASCADE,
      status VARCHAR(50) DEFAULT 'Not Run',
      assignee_id INTEGER REFERENCES users(id),
      notes TEXT,
      executed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS test_cycles (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      name VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'Planned',
      owner_id INTEGER REFERENCES users(id),
      planned_start TIMESTAMPTZ,
      planned_end TIMESTAMPTZ,
      summary TEXT,
      estimated_minutes INTEGER,
      actual_minutes INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cycle_cases (
      id SERIAL PRIMARY KEY,
      cycle_id INTEGER REFERENCES test_cycles(id) ON DELETE CASCADE,
      test_case_id INTEGER REFERENCES test_cases(id) ON DELETE CASCADE,
      status VARCHAR(50) DEFAULT 'Not Executed',
      assignee_id INTEGER REFERENCES users(id),
      executed_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS defects (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      severity VARCHAR(50) DEFAULT 'Major',
      priority VARCHAR(50) DEFAULT 'Medium',
      status VARCHAR(50) DEFAULT 'Open',
      assignee_id INTEGER REFERENCES users(id),
      reporter_id INTEGER REFERENCES users(id),
      linked_test_case_id INTEGER REFERENCES test_cases(id),
      linked_cycle_id INTEGER REFERENCES test_cycles(id),
      linked_run_id INTEGER REFERENCES test_runs(id),
      environment VARCHAR(200),
      steps_to_reproduce TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const tcColumns = [
    ['modul_fitur', 'VARCHAR(500)'],
    ['user_story_coverage', 'TEXT'],
    ['tipe_test', 'VARCHAR(200)'],
    ['user_role', 'VARCHAR(200)'],
    ['tujuan_pengujian', 'TEXT'],
    ['langkah_uji', 'TEXT'],
    ['validasi_data_uji', 'TEXT'],
    ['hasil_yang_diharapkan', 'TEXT'],
    ['pic_qa', 'VARCHAR(255)'],
    ['status_sit', 'VARCHAR(100)'],
    ['date_sit_executed', 'DATE'],
    ['date_sit_done', 'DATE'],
    ['object_test_version', 'VARCHAR(100)'],
    ['api_version', 'VARCHAR(100)'],
    ['test_scenario_version', 'VARCHAR(100)'],
    ['requirement_id', 'INTEGER REFERENCES requirements(id)'],
  ];
  for (const [col, type] of tcColumns) {
    try {
      await pool.query(`ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS ${col} ${type}`);
    } catch (_e) { /* ignore race */ }
  }

  const trColumns = [
    ['estimated_minutes', 'INTEGER'],
    ['actual_minutes', 'INTEGER'],
  ];
  for (const [col, type] of trColumns) {
    try {
      await pool.query(`ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS ${col} ${type}`);
    } catch (_e) {}
  }
  const cyColumns = [
    ['estimated_minutes', 'INTEGER'],
    ['actual_minutes', 'INTEGER'],
  ];
  for (const [col, type] of cyColumns) {
    try {
      await pool.query(`ALTER TABLE test_cycles ADD COLUMN IF NOT EXISTS ${col} ${type}`);
    } catch (_e) {}
  }

  const defectColumns = [
    ['priority', 'VARCHAR(50) DEFAULT \'Medium\''],
    ['reporter_id', 'INTEGER REFERENCES users(id)'],
    ['linked_cycle_id', 'INTEGER REFERENCES test_cycles(id)'],
    ['linked_run_id', 'INTEGER REFERENCES test_runs(id)'],
    ['environment', 'VARCHAR(200)'],
    ['steps_to_reproduce', 'TEXT'],
  ];
  for (const [col, type] of defectColumns) {
    try {
      await pool.query(`ALTER TABLE defects ADD COLUMN IF NOT EXISTS ${col} ${type}`);
    } catch (_e) {}
  }

  const reqColumns = [
    ['user_story', 'TEXT'],
    ['acceptance_criteria', 'TEXT'],
  ];
  for (const [col, type] of reqColumns) {
    try {
      await pool.query(`ALTER TABLE requirements ADD COLUMN IF NOT EXISTS ${col} ${type}`);
    } catch (_e) {}
  }

  await seedDatabase(pool);
}
