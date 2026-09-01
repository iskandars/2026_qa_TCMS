import bcrypt from 'bcryptjs';

export async function seedDatabase(pool) {
  const userSeed = [
    {
      name: 'Arif Rahman',
      email: 'qa.lead@company.com',
      password: 'Password123!',
      role: 'qa_lead',
      department: 'Quality Assurance',
      avatar: 'AR',
      sso_provider: 'local',
    },
    {
      name: 'Siti Nurasiah',
      email: 'qa.engineer@company.com',
      password: 'Password123!',
      role: 'qa_engineer',
      department: 'Quality Assurance',
      avatar: 'SN',
      sso_provider: 'local',
    },
    {
      name: 'Budi Prasetyo',
      email: 'product@company.com',
      password: 'Password123!',
      role: 'product',
      department: 'Product',
      avatar: 'BP',
      sso_provider: 'local',
    },
    {
      name: 'Rina Kurnia',
      email: 'pm@company.com',
      password: 'Password123!',
      role: 'pm',
      department: 'Program Management',
      avatar: 'RK',
      sso_provider: 'local',
    },
    {
      name: 'Dwi Hartanto',
      email: 'business.analyst@company.com',
      password: 'Password123!',
      role: 'business_analyst',
      department: 'Business Analysis',
      avatar: 'DH',
      sso_provider: 'local',
    },
  ];

  for (const user of userSeed) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
    if (existing.rowCount === 0) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, department, avatar, sso_provider)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.name, user.email, passwordHash, user.role, user.department, user.avatar, user.sso_provider]
      );
    }
  }

  const projectSeed = [
    {
      name: 'Customer Portal',
      key_code: 'CP',
      description: 'Customer-facing portal and onboarding flows',
      status: 'Active',
      owner_email: 'qa.lead@company.com',
    },
    {
      name: 'Warehouse Ops',
      key_code: 'WO',
      description: 'Warehouse management and fulfillment',
      status: 'Active',
      owner_email: 'pm@company.com',
    },
  ];

  for (const project of projectSeed) {
    const exists = await pool.query('SELECT id FROM projects WHERE key_code = $1', [project.key_code]);
    if (exists.rowCount === 0) {
      const ownerUser = await pool.query('SELECT id FROM users WHERE email = $1', [project.owner_email]);
      const ownerId = ownerUser.rows[0]?.id ?? null;
      await pool.query(
        `INSERT INTO projects (name, key_code, description, status, owner_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [project.name, project.key_code, project.description, project.status, ownerId]
      );
    }
  }

  const testCaseSeed = [
    {
      project_key: 'CP',
      code: 'CP-101',
      title: 'Login with valid credentials',
      summary: 'Verify login success for valid account',
      status: 'Passed',
      severity: 'Major',
      priority: 'High',
      assignee_email: 'qa.engineer@company.com',
      creator_email: 'qa.lead@company.com',
      steps: '1. Open login page\n2. Enter valid email\n3. Enter password\n4. Click Sign In',
      expected_result: 'User is redirected to the dashboard',
      actual_result: 'Dashboard loads successfully',
      tags: 'auth,smoke',
    },
    {
      project_key: 'CP',
      code: 'CP-102',
      title: 'Login with invalid password',
      summary: 'Verify failed login error message',
      status: 'Failed',
      severity: 'Critical',
      priority: 'High',
      assignee_email: 'qa.engineer@company.com',
      creator_email: 'qa.lead@company.com',
      steps: '1. Open login page\n2. Enter wrong password\n3. Click Sign In',
      expected_result: 'Validation warning appears',
      actual_result: 'Generic error is shown without specific guidance',
      tags: 'auth,bug',
    },
    {
      project_key: 'WO',
      code: 'WO-201',
      title: 'Create outbound shipment',
      summary: 'Workflow for shipping selected items',
      status: 'Retest',
      severity: 'Major',
      priority: 'High',
      assignee_email: 'qa.engineer@company.com',
      creator_email: 'pm@company.com',
      steps: '1. Select order\n2. Assign warehouse\n3. Create shipment\n4. Review summary',
      expected_result: 'Shipment is generated and shown in list',
      actual_result: 'Shipment created but status not refreshed',
      tags: 'warehouse,workflow',
    },
    {
      project_key: 'CP',
      code: 'CP-103',
      title: 'Profile update validation',
      summary: 'Confirm profile can be edited without validation errors',
      status: 'Passed',
      severity: 'Minor',
      priority: 'Medium',
      assignee_email: 'qa.engineer@company.com',
      creator_email: 'product@company.com',
      steps: '1. Open profile\n2. Edit display name\n3. Save',
      expected_result: 'Profile updated successfully',
      actual_result: 'Profile saved correctly',
      tags: 'profile',
    },
    {
      project_key: 'WO',
      code: 'WO-202',
      title: 'Inventory count reconciliation',
      summary: 'Confirm inventory totals display correctly after count adjustments',
      status: 'TBC',
      severity: 'Medium',
      priority: 'Medium',
      assignee_email: 'qa.engineer@company.com',
      creator_email: 'qa.lead@company.com',
      steps: '1. Open stock reconciliation\n2. Update count\n3. Verify totals',
      expected_result: 'Inventory values must match system of record',
      actual_result: 'Pending execution',
      tags: 'inventory',
    },
  ];

  for (const testCase of testCaseSeed) {
    const exists = await pool.query('SELECT id FROM test_cases WHERE code = $1', [testCase.code]);
    if (exists.rowCount === 0) {
      const project = await pool.query('SELECT id FROM projects WHERE key_code = $1', [testCase.project_key]);
      const assignee = await pool.query('SELECT id FROM users WHERE email = $1', [testCase.assignee_email]);
      const creator = await pool.query('SELECT id FROM users WHERE email = $1', [testCase.creator_email]);

      await pool.query(
        `INSERT INTO test_cases (
          project_id, code, title, summary, status, severity, priority, assignee_id, creator_id,
          steps, expected_result, actual_result, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          project.rows[0]?.id,
          testCase.code,
          testCase.title,
          testCase.summary,
          testCase.status,
          testCase.severity,
          testCase.priority,
          assignee.rows[0]?.id ?? null,
          creator.rows[0]?.id ?? null,
          testCase.steps,
          testCase.expected_result,
          testCase.actual_result,
          testCase.tags,
        ]
      );
    }
  }

  const runSeed = [
    {
      project_key: 'CP',
      name: 'Sprint 26 Regression',
      status: 'Active',
      created_by_email: 'qa.lead@company.com',
    },
    {
      project_key: 'WO',
      name: 'Warehouse Release Candidate',
      status: 'Planned',
      created_by_email: 'pm@company.com',
    },
  ];

  for (const run of runSeed) {
    const exists = await pool.query('SELECT id FROM test_runs WHERE name = $1', [run.name]);
    if (exists.rowCount === 0) {
      const project = await pool.query('SELECT id FROM projects WHERE key_code = $1', [run.project_key]);
      const creator = await pool.query('SELECT id FROM users WHERE email = $1', [run.created_by_email]);
      await pool.query(
        `INSERT INTO test_runs (project_id, name, status, created_by, planned_start)
         VALUES ($1, $2, $3, $4, NOW())`,
        [project.rows[0]?.id, run.name, run.status, creator.rows[0]?.id]
      );
    }
  }

  const requirementSeed = [
    {
      project_key: 'CP',
      title: 'Authentication and authorization security enhancement',
      description: 'Users must be able to sign in securely and receive clear validation feedback for invalid credentials.',
      status: 'Approved',
      priority: 'High',
      source: 'Business',
      created_by_email: 'product@company.com',
    },
    {
      project_key: 'WO',
      title: 'Shipment status refresh after creation',
      description: 'The warehouse management system must display updated shipment state as soon as the record is saved.',
      status: 'In Review',
      priority: 'High',
      source: 'Operations',
      created_by_email: 'pm@company.com',
    },
  ];

  for (const requirement of requirementSeed) {
    const exists = await pool.query('SELECT id FROM requirements WHERE title = $1', [requirement.title]);
    if (exists.rowCount === 0) {
      const project = await pool.query('SELECT id FROM projects WHERE key_code = $1', [requirement.project_key]);
      const creator = await pool.query('SELECT id FROM users WHERE email = $1', [requirement.created_by_email]);
      await pool.query(
        `INSERT INTO requirements (project_id, title, description, status, priority, source, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [project.rows[0]?.id, requirement.title, requirement.description, requirement.status, requirement.priority, requirement.source, creator.rows[0]?.id]
      );
    }
  }

  const cycleSeed = [
    {
      project_key: 'CP',
      name: 'CP Sprint 26 Regression',
      status: 'Active',
      owner_email: 'qa.lead@company.com',
      summary: 'Regression coverage for customer portal release',
    },
    {
      project_key: 'WO',
      name: 'WO Release Candidate',
      status: 'Planned',
      owner_email: 'pm@company.com',
      summary: 'Focus on inventory and warehouse validations',
    },
  ];

  for (const cycle of cycleSeed) {
    const exists = await pool.query('SELECT id FROM test_cycles WHERE name = $1', [cycle.name]);
    if (exists.rowCount === 0) {
      const project = await pool.query('SELECT id FROM projects WHERE key_code = $1', [cycle.project_key]);
      const owner = await pool.query('SELECT id FROM users WHERE email = $1', [cycle.owner_email]);
      await pool.query(
        `INSERT INTO test_cycles (project_id, name, status, owner_id, summary, planned_start, planned_end)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '7 days')`,
        [project.rows[0]?.id, cycle.name, cycle.status, owner.rows[0]?.id, cycle.summary]
      );
    }
  }

  const cycleCaseSeed = [
    { cycle_name: 'CP Sprint 26 Regression', test_case_code: 'CP-101', status: 'Passed', assignee_email: 'qa.engineer@company.com', notes: 'Smoke execution passed' },
    { cycle_name: 'CP Sprint 26 Regression', test_case_code: 'CP-102', status: 'Failed', assignee_email: 'qa.engineer@company.com', notes: 'Bug raised and triaged' },
    { cycle_name: 'WO Release Candidate', test_case_code: 'WO-201', status: 'Retest', assignee_email: 'qa.engineer@company.com', notes: 'Waiting for defect validation' },
  ];

  for (const item of cycleCaseSeed) {
    const cycle = await pool.query('SELECT id FROM test_cycles WHERE name = $1', [item.cycle_name]);
    const testCase = await pool.query('SELECT id FROM test_cases WHERE code = $1', [item.test_case_code]);
    const assignee = await pool.query('SELECT id FROM users WHERE email = $1', [item.assignee_email]);
    const exists = await pool.query('SELECT id FROM cycle_cases WHERE cycle_id = $1 AND test_case_id = $2', [cycle.rows[0]?.id, testCase.rows[0]?.id]);

    if (cycle.rows[0] && testCase.rows[0] && exists.rowCount === 0) {
      await pool.query(
        `INSERT INTO cycle_cases (cycle_id, test_case_id, status, assignee_id, executed_at, notes)
         VALUES ($1, $2, $3, $4, NOW(), $5)`,
        [cycle.rows[0].id, testCase.rows[0].id, item.status, assignee.rows[0]?.id ?? null, item.notes]
      );
    }
  }

  const defectSeed = [
    {
      project_key: 'CP',
      title: 'Login error message is not user-friendly',
      description: 'When invalid password is entered, the application returns a generic issue without guidance.',
      severity: 'Critical',
      status: 'Open',
      assignee_email: 'qa.engineer@company.com',
      linked_code: 'CP-102',
    },
    {
      project_key: 'WO',
      title: 'Shipment status not refreshed after creation',
      description: 'Status remains stale even after a shipment is created.',
      severity: 'Major',
      status: 'In Progress',
      assignee_email: 'qa.engineer@company.com',
      linked_code: 'WO-201',
    },
  ];

  for (const defect of defectSeed) {
    const exists = await pool.query('SELECT id FROM defects WHERE title = $1', [defect.title]);
    if (exists.rowCount === 0) {
      const project = await pool.query('SELECT id FROM projects WHERE key_code = $1', [defect.project_key]);
      const assignee = await pool.query('SELECT id FROM users WHERE email = $1', [defect.assignee_email]);
      const linked = await pool.query('SELECT id FROM test_cases WHERE code = $1', [defect.linked_code]);
      await pool.query(
        `INSERT INTO defects (project_id, title, description, severity, status, assignee_id, linked_test_case_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [project.rows[0]?.id, defect.title, defect.description, defect.severity, defect.status, assignee.rows[0]?.id, linked.rows[0]?.id]
      );
    }
  }
}
