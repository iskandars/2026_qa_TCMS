import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfParseModule from 'pdf-parse';
import PDFDocument from 'pdfkit';

const pdfParse = pdfParseModule.default || pdfParseModule;
import { initializeDatabase, pool } from './db.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okExts = ['.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (okExts.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF files are allowed for requirement uploads.'));
  },
});

const ROLE_LABELS = {
  qa_lead: 'QA Lead',
  qa_engineer: 'QA Engineer',
  product: 'Product',
  pm: 'PM',
  business_analyst: 'Business Analyst',
};

const ROLE_PERMISSIONS = {
  qa_lead: ['read', 'write', 'approve', 'manage_users', 'bulk_import', 'generate_scenarios', 'export_reports', 'upload_requirements', 'manage_cycles'],
  qa_engineer: ['read', 'write', 'execute', 'bulk_import', 'export_reports', 'upload_requirements'],
  product: ['read', 'write', 'approve', 'export_reports', 'upload_requirements'],
  pm: ['read', 'write', 'approve', 'manage_cycles', 'export_reports', 'upload_requirements'],
  business_analyst: ['read', 'write_requirements', 'approve_requirements', 'upload_requirements', 'export_reports'],
};

const DEFECT_WORKFLOW = ['Open', 'In Progress', 'In Review', 'Rejected', 'Resolved', 'Closed'];
const TIPE_TEST_OPTIONS = ['Functional', 'Regression', 'Integration', 'API', 'UI', 'Performance', 'Security', 'UAT', 'SIT', 'Smoke', 'Sanity'];
const USER_ROLE_OPTIONS = ['Admin', 'User', 'Guest', 'Manager', 'Operator', 'Customer', 'Teller', 'Back Office'];

const AVG_MINUTES_PER_STEP = {
  Trivial: 2,
  Minor: 4,
  Major: 7,
  Critical: 12,
};

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    label: ROLE_LABELS[user.role] || user.role,
    department: user.department,
    avatar: user.avatar,
    active: user.active,
    ssoProvider: user.sso_provider,
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.jwtSecret, {
    expiresIn: '8h',
  });
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission for this action.' });
    }
    next();
  };
}

function hasPermission(userRole, permission) {
  return (ROLE_PERMISSIONS[userRole] || []).includes(permission);
}

function countSteps(stepsText) {
  if (!stepsText) return 1;
  const lines = stepsText.split(/[\n;1-9.、]/).filter((s) => s.trim().length > 0);
  return Math.max(1, lines.length);
}

function estimateTestCaseTime(testCase) {
  const steps = countSteps(testCase.langkah_uji || testCase.steps || '');
  const base = AVG_MINUTES_PER_STEP[testCase.severity] || 5;
  return steps * base;
}

function chunkText(text, chunkSize = 800, overlap = 100) {
  if (!text) return [];
  const clean = text.replace(/\s+/g, ' ').trim();
  const chunks = [];
  let i = 0;
  while (i < clean.length) {
    const chunk = clean.slice(i, i + chunkSize);
    if (chunk.trim()) chunks.push(chunk.trim());
    i += Math.max(1, chunkSize - overlap);
  }
  return chunks;
}

function extractUserStoriesFromText(text) {
  if (!text) return [];
  const lines = text.split(/[\n.。]/).map((l) => l.trim()).filter(Boolean);
  const stories = [];
  const keywords = ['sebagai', 'as a', 'want to', 'ingin', 'can', 'dapat', 'fitur', 'feature', 'requirement', 'kebutuhan', 'modul', 'module'];
  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    if (keywords.some((k) => lower.includes(k)) || line.length > 40) {
      stories.push({
        id: `US-AUTO-${idx + 1}`,
        title: line.length > 200 ? line.slice(0, 200) + '...' : line,
        description: line,
        priority: idx < 3 ? 'High' : idx < 6 ? 'Medium' : 'Low',
      });
    }
  });
  return stories.slice(0, 50);
}

function generateTestScenariosFromStories(stories, projectContext = {}) {
  const scenarios = [];
  const tipeOptions = TIPE_TEST_OPTIONS.slice(0, 4);
  stories.forEach((story, sIdx) => {
    const variants = [
      { title: `Positive flow - ${story.title}`, tipe: 'Functional', severity: 'Major' },
      { title: `Negative flow - ${story.title}`, tipe: 'Functional', severity: 'Major' },
      { title: `Boundary validation - ${story.title}`, tipe: 'Functional', severity: 'Minor' },
      { title: `UI/UX verification - ${story.title}`, tipe: 'UI', severity: 'Minor' },
    ];
    variants.slice(0, projectContext.fullCoverage ? 4 : 2).forEach((v, vIdx) => {
      scenarios.push({
        code: `${projectContext.prefix || 'TC'}-${(sIdx * 10) + vIdx + 1}`,
        title: v.title,
        modul_fitur: story.title.slice(0, 200),
        user_story_coverage: story.id,
        tipe_test: v.tipe,
        severity: v.severity,
        tujuan_pengujian: `Verify that user story ${story.id}: ${story.title} works correctly under ${v.tipe.toLowerCase()} test conditions.`,
        langkah_uji: `1. Navigate to the feature related to ${story.title}\n2. Prepare test data for ${v.tipe.toLowerCase()} scenario\n3. Execute the flow described in the requirement\n4. Observe system behavior and outputs\n5. Record any deviations from expected behavior`,
        validasi_data_uji: `Input validation: valid & invalid formats, boundary values (min/max length, null/empty, special characters). Output validation: data integrity, field mappings, error messages, audit trail.`,
        hasil_yang_diharapkan: `System should handle the scenario correctly: valid inputs succeed with proper confirmation; invalid inputs are rejected with clear user-friendly error messages and no data corruption.`,
        user_role: USER_ROLE_OPTIONS[sIdx % USER_ROLE_OPTIONS.length],
        pic_qa: 'QA Team',
        test_scenario_version: '1.0',
        status: 'Draft',
        priority: story.priority,
        steps: `1. Navigate to the feature related to ${story.title}\n2. Prepare test data for ${v.tipe.toLowerCase()} scenario\n3. Execute the flow described in the requirement\n4. Observe system behavior and outputs\n5. Record any deviations from expected behavior`,
        expected_result: `System should handle the scenario correctly: valid inputs succeed with proper confirmation; invalid inputs are rejected with clear user-friendly error messages and no data corruption.`,
        summary: v.title,
      });
    });
  });
  return scenarios;
}

async function parsePdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const result = await pdfParse(dataBuffer);
  return result.text || '';
}

async function queryLLM(prompt, fallback) {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) return fallback;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a QA automation expert specializing in requirement analysis and comprehensive test case generation. Respond in JSON format when requested.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content || fallback;
  } catch {
    return fallback;
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TCMS API running', timestamp: new Date().toISOString() });
});

app.get('/api/auth/sso/config', (req, res) => {
  res.json({
    enabled: config.ssoEnabled,
    provider: 'oidc',
    issuer: process.env.SSO_ISSUER || 'https://example.okta.com/oauth2/default',
    clientId: process.env.SSO_CLIENT_ID || 'tcms-demo',
    callbackUrl: `${config.frontendUrl}/auth/callback`,
    scopes: ['openid', 'profile', 'email'],
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [String(email).trim().toLowerCase()]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isValid = await bcrypt.compare(String(password), user.password_hash || '');
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = signToken(user);
    return res.json({ token, user: sanitizeUser(user), permissions: ROLE_PERMISSIONS[user.role] || [] });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to process login.' });
  }
});

app.post('/api/auth/sso/login', async (req, res) => {
  if (!config.ssoEnabled) {
    return res.status(400).json({ message: 'SSO is disabled in the current environment.' });
  }

  try {
    const { email, name, role } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'SSO email is required.' });
    }

    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [String(email).trim().toLowerCase()]);
    let user = userResult.rows[0];

    if (!user) {
      const roleValue = role && ROLE_LABELS[role] ? role : 'qa_engineer';
      const inserted = await pool.query(
        `INSERT INTO users (name, email, role, department, avatar, sso_provider, active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING *`,
        [name || 'SSO User', String(email).trim().toLowerCase(), roleValue, 'Identity Provider', 'SSO', 'oidc']
      );
      user = inserted.rows[0];
    }

    const token = signToken(user);
    return res.json({ token, user: sanitizeUser(user), permissions: ROLE_PERMISSIONS[user.role] || [] });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to complete SSO login.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ user: sanitizeUser(user), permissions: ROLE_PERMISSIONS[user.role] || [] });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to load profile.' });
  }
});

app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY name ASC');
    res.json({ users: result.rows.map(sanitizeUser) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch users.' });
  }
});

app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.name AS owner_name
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      ORDER BY p.updated_at DESC
    `);
    res.json({ projects: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch projects.' });
  }
});

app.post('/api/projects', requireAuth, requireRoles('qa_lead', 'pm', 'product'), async (req, res) => {
  const { name, keyCode, description, status = 'Active', ownerId } = req.body || {};
  if (!name || !keyCode) {
    return res.status(400).json({ message: 'Project name and key are required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO projects (name, key_code, description, status, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, keyCode.toUpperCase(), description || '', status, ownerId || req.user.sub]
    );
    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create project.' });
  }
});

app.get('/api/requirements', requireAuth, async (req, res) => {
  try {
    const { projectId, status, priority } = req.query;
    const filters = [];
    const params = [];
    let q = `
      SELECT r.*, p.name AS project_name, u.name AS created_by_name
      FROM requirements r
      LEFT JOIN projects p ON p.id = r.project_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE 1=1
    `;
    if (projectId) { filters.push(`r.project_id = $${params.length + 1}`); params.push(projectId); }
    if (status) { filters.push(`r.status = $${params.length + 1}`); params.push(status); }
    if (priority) { filters.push(`r.priority = $${params.length + 1}`); params.push(priority); }
    if (filters.length) q += ` AND ${filters.join(' AND ')}`;
    q += ` ORDER BY r.updated_at DESC`;
    const result = await pool.query(q, params);
    res.json({ requirements: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch requirements.' });
  }
});

app.post('/api/requirements', requireAuth, requireRoles('qa_lead', 'pm', 'product', 'business_analyst'), async (req, res) => {
  const { projectId, title, description, status = 'Draft', priority = 'Medium', source = 'Business', userStory, acceptanceCriteria } = req.body || {};
  if (!projectId || !title) {
    return res.status(400).json({ message: 'Project and title are required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO requirements (project_id, title, description, status, priority, source, created_by, user_story, acceptance_criteria)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [projectId, title, description || '', status, priority, source, req.user.sub, userStory || '', acceptanceCriteria || '']
    );
    res.status(201).json({ requirement: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create requirement.' });
  }
});

app.post('/api/requirements/upload-pdf', requireAuth, requireRoles('qa_lead', 'pm', 'product', 'business_analyst', 'qa_engineer'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'PDF file is required.' });
    const { projectId, requirementId } = req.body || {};
    const filePath = req.file.path;

    let extractedText = '';
    try {
      extractedText = await parsePdf(filePath);
    } catch (pdfErr) {
      extractedText = `PDF extraction failed: ${pdfErr.message}`;
    }

    const ragChunks = chunkText(extractedText);
    const userStories = extractUserStoriesFromText(extractedText);

    const prompt = `Analyze this requirements document text and break it down into distinct user stories with IDs, titles, descriptions, and priorities (High/Medium/Low). Respond as JSON array: [{id, title, description, priority}].\n\nDocument: ${extractedText.slice(0, 8000)}`;
    const llmStoriesRaw = await queryLLM(prompt, JSON.stringify(userStories));
    let storiesFromLLM = userStories;
    try {
      const parsed = JSON.parse(llmStoriesRaw.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed) && parsed.length) storiesFromLLM = parsed;
    } catch {}

    const docResult = await pool.query(
      `INSERT INTO requirement_documents (requirement_id, project_id, file_name, file_path, file_size, extracted_text, rag_chunks, user_story_breakdown, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [requirementId || null, projectId || null, req.file.originalname, filePath, req.file.size, extractedText, JSON.stringify(ragChunks), JSON.stringify(storiesFromLLM), req.user.sub]
    );

    res.status(201).json({
      document: docResult.rows[0],
      extractedText: extractedText.slice(0, 2000),
      ragChunkCount: ragChunks.length,
      userStories: storiesFromLLM,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to process PDF upload.' });
  }
});

app.get('/api/requirement-documents', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rd.*, p.name AS project_name, u.name AS uploaded_by_name, r.title AS requirement_title
      FROM requirement_documents rd
      LEFT JOIN projects p ON p.id = rd.project_id
      LEFT JOIN users u ON u.id = rd.uploaded_by
      LEFT JOIN requirements r ON r.id = rd.requirement_id
      ORDER BY rd.created_at DESC
    `);
    res.json({ documents: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch requirement documents.' });
  }
});

app.post('/api/test-cases', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'product', 'pm'), async (req, res) => {
  const body = req.body || {};
  if (!body.projectId || !body.code || !body.title) {
    return res.status(400).json({ message: 'Project, code, and title are required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO test_cases (
        project_id, code, title, summary, status, severity, priority, assignee_id, creator_id,
        tags, steps, expected_result, modul_fitur, user_story_coverage, tipe_test, user_role,
        tujuan_pengujian, langkah_uji, validasi_data_uji, hasil_yang_diharapkan,
        pic_qa, status_sit, date_sit_executed, date_sit_done, object_test_version,
        api_version, test_scenario_version, requirement_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
      RETURNING *`,
      [
        body.projectId, body.code, body.title, body.summary || '', body.status || 'Draft', body.severity || 'Medium',
        body.priority || 'Medium', body.assigneeId || null, req.user.sub, body.tags || '', body.steps || body.langkah_uji || '',
        body.expectedResult || body.hasil_yang_diharapkan || '', body.modulFitur || body.modul_fitur || '',
        body.userStoryCoverage || body.user_story_coverage || '', body.tipeTest || body.tipe_test || 'Functional',
        body.userRole || body.user_role || '', body.tujuanPengujian || body.tujuan_pengujian || '',
        body.langkahUji || body.langkah_uji || body.steps || '',
        body.validasiDataUji || body.validasi_data_uji || '',
        body.hasilYangDiharapkan || body.hasil_yang_diharapkan || body.expectedResult || '',
        body.picQA || body.pic_qa || '', body.statusSIT || body.status_sit || 'Not Started',
        body.dateSITExecuted || body.date_sit_executed || null, body.dateSITDone || body.date_sit_done || null,
        body.objectTestVersion || body.object_test_version || '', body.apiVersion || body.api_version || '',
        body.testScenarioVersion || body.test_scenario_version || '', body.requirementId || body.requirement_id || null,
      ]
    );

    res.status(201).json({ testCase: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create test case.' });
  }
});

app.get('/api/test-cases/template', requireAuth, (req, res) => {
  const headers = [
    'No', 'Project', 'Test Case ID', 'Modul & Fitur', 'User Story Coverage', 'Tipe Test',
    'User / Role', 'Tujuan Pengujian', 'Langkah Uji', 'Validasi Data Uji', 'Hasil Yang Diharapkan',
    'PIC QA', 'Status SIT', 'Date SIT Executed', 'Date SIT Done', 'Object Test Version',
    'API Version', 'Test Scenario Version'
  ];
  const sample = [
    headers,
    [1, 'Core Platform', 'CP-001', 'User Authentication Module', 'US-001 Login Feature', 'Functional', 'Teller',
      'Verify teller can login with valid credentials', '1. Open login page\n2. Input valid teller username\n3. Input valid password\n4. Click login',
      'Username: valid_teller, Password: valid_pass format', 'User is redirected to dashboard, session created, audit log entry',
      'QA-01', 'Not Started', '', '', 'v1.0.0', 'v2.1.0', 'v1.0'],
    [2, 'Core Platform', 'CP-002', 'User Authentication Module', 'US-001 Login Feature', 'Functional', 'Teller',
      'Verify login rejects invalid password', '1. Open login page\n2. Input valid username\n3. Input wrong password\n4. Click login',
      'Username: valid_teller, Password: wrong_value', 'Error message displayed, no session, no redirection',
      'QA-01', 'Not Started', '', '', 'v1.0.0', 'v2.1.0', 'v1.0'],
  ];
  const csv = sample.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="test-scenario-template.csv"');
  res.send('\uFEFF' + csv);
});

app.get('/api/test-cases', requireAuth, async (req, res) => {
  try {
    const { projectId, status, severity, priority, assigneeId, modulFitur, tipeTest, statusSIT, search, userStoryCoverage } = req.query;
    const filters = [];
    const params = [];
    let q = `
      SELECT tc.*, p.name AS project_name, u.name AS assignee_name, c.name AS creator_name,
             r.title AS requirement_title
      FROM test_cases tc
      LEFT JOIN projects p ON p.id = tc.project_id
      LEFT JOIN users u ON u.id = tc.assignee_id
      LEFT JOIN users c ON c.id = tc.creator_id
      LEFT JOIN requirements r ON r.id = tc.requirement_id
      WHERE 1=1
    `;
    if (projectId) { filters.push(`tc.project_id = $${params.length + 1}`); params.push(projectId); }
    if (status) { filters.push(`tc.status = $${params.length + 1}`); params.push(status); }
    if (severity) { filters.push(`tc.severity = $${params.length + 1}`); params.push(severity); }
    if (priority) { filters.push(`tc.priority = $${params.length + 1}`); params.push(priority); }
    if (assigneeId) { filters.push(`tc.assignee_id = $${params.length + 1}`); params.push(assigneeId); }
    if (modulFitur) { filters.push(`tc.modul_fitur ILIKE $${params.length + 1}`); params.push(`%${modulFitur}%`); }
    if (tipeTest) { filters.push(`tc.tipe_test = $${params.length + 1}`); params.push(tipeTest); }
    if (statusSIT) { filters.push(`tc.status_sit = $${params.length + 1}`); params.push(statusSIT); }
    if (userStoryCoverage) { filters.push(`tc.user_story_coverage ILIKE $${params.length + 1}`); params.push(`%${userStoryCoverage}%`); }
    if (search) {
      filters.push(`(tc.title ILIKE $${params.length + 1} OR tc.code ILIKE $${params.length + 1} OR tc.summary ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (filters.length) q += ` AND ${filters.join(' AND ')}`;
    q += ` ORDER BY tc.updated_at DESC`;

    const result = await pool.query(q, params);
    res.json({ testCases: result.rows, tipeTestOptions: TIPE_TEST_OPTIONS, userRoleOptions: USER_ROLE_OPTIONS });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch test cases.' });
  }
});

app.post('/api/test-cases/bulk', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm', 'product'), async (req, res) => {
  const { items = [], projectId } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'No test cases provided for bulk import.' });
  }
  try {
    const created = [];
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const projectName = row['Project'] || row.project || (projectId ? null : 'Imported');
      let resolvedProjectId = projectId;
      if (!resolvedProjectId && projectName) {
        const proj = await pool.query('SELECT id FROM projects WHERE name = $1 OR key_code = $1 LIMIT 1', [projectName]);
        resolvedProjectId = proj.rows[0]?.id;
        if (!resolvedProjectId) {
          const np = await pool.query(
            `INSERT INTO projects (name, key_code, description, owner_id) VALUES ($1, $2, $3, $4) ON CONFLICT (key_code) DO NOTHING RETURNING id`,
            [projectName, `PRJ-${(Math.random().toString(36).slice(2, 7)).toUpperCase()}`, 'Auto-created from bulk import', req.user.sub]
          );
          resolvedProjectId = np.rows[0]?.id;
          if (!resolvedProjectId) {
            const back = await pool.query('SELECT id FROM projects WHERE name = $1', [projectName]);
            resolvedProjectId = back.rows[0]?.id || 1;
          }
        }
      }
      if (!resolvedProjectId) resolvedProjectId = 1;

      const code = row['Test Case ID'] || row.code || `TC-${Date.now()}-${i + 1}`;
      const title = row['Modul & Fitur'] || row.title || `Imported Test Case ${i + 1}`;
      const result = await pool.query(
        `INSERT INTO test_cases (
          project_id, code, title, summary, status, severity, priority, creator_id,
          steps, expected_result, modul_fitur, user_story_coverage, tipe_test, user_role,
          tujuan_pengujian, langkah_uji, validasi_data_uji, hasil_yang_diharapkan,
          pic_qa, status_sit, date_sit_executed, date_sit_done, object_test_version,
          api_version, test_scenario_version, tags
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
        RETURNING *`,
        [
          resolvedProjectId, code, title,
          row['Tujuan Pengujian'] || row.summary || '',
          row['Status SIT'] && row['Status SIT'] !== 'Not Started' ? 'Ready' : row.status || 'Draft',
          row['Severity'] || row.severity || (row['Tipe Test'] === 'Performance' ? 'Major' : 'Medium'),
          row['Priority'] || row.priority || 'Medium',
          req.user.sub,
          row['Langkah Uji'] || row.steps || '',
          row['Hasil Yang Diharapkan'] || row.expectedResult || '',
          row['Modul & Fitur'] || row.modul_fitur || '',
          row['User Story Coverage'] || row.user_story_coverage || '',
          row['Tipe Test'] || row.tipe_test || 'Functional',
          row['User / Role'] || row.user_role || '',
          row['Tujuan Pengujian'] || row.tujuan_pengujian || '',
          row['Langkah Uji'] || row.langkah_uji || row.steps || '',
          row['Validasi Data Uji'] || row.validasi_data_uji || '',
          row['Hasil Yang Diharapkan'] || row.hasil_yang_diharapkan || '',
          row['PIC QA'] || row.pic_qa || '',
          row['Status SIT'] || row.status_sit || 'Not Started',
          row['Date SIT Executed'] || row.date_sit_executed || null,
          row['Date SIT Done'] || row.date_sit_done || null,
          row['Object Test Version'] || row.object_test_version || '',
          row['API Version'] || row.api_version || '',
          row['Test Scenario Version'] || row.test_scenario_version || '',
          row['Tags'] || row.tags || '',
        ]
      );
      created.push(result.rows[0]);
    }
    res.status(201).json({ testCases: created, imported: created.length });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to complete bulk import.' });
  }
});

app.post('/api/test-scenarios/generate', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm', 'product', 'business_analyst'), async (req, res) => {
  try {
    const { projectId, requirementId, documentId, source = 'auto', userStories: customStories, prefix, fullCoverage = false } = req.body || {};

    let stories = [];
    if (Array.isArray(customStories) && customStories.length) {
      stories = customStories;
    } else if (documentId) {
      const doc = await pool.query('SELECT user_story_breakdown, extracted_text FROM requirement_documents WHERE id = $1', [documentId]);
      if (doc.rows[0]) {
        try {
          stories = JSON.parse(doc.rows[0].user_story_breakdown || '[]');
        } catch {
          stories = extractUserStoriesFromText(doc.rows[0].extracted_text || '');
        }
      }
    } else if (requirementId) {
      const reqRow = await pool.query('SELECT * FROM requirements WHERE id = $1', [requirementId]);
      if (reqRow.rows[0]) {
        const r = reqRow.rows[0];
        const text = `${r.title}\n${r.description || ''}\n${r.user_story || ''}\n${r.acceptance_criteria || ''}`;
        stories = extractUserStoriesFromText(text);
        if (!stories.length) {
          stories = [{ id: `US-${r.id}`, title: r.title, description: r.description || r.title, priority: r.priority || 'Medium' }];
        }
      }
    } else if (projectId) {
      const reqs = await pool.query('SELECT * FROM requirements WHERE project_id = $1 LIMIT 20', [projectId]);
      if (reqs.rows.length) {
        reqs.rows.forEach((r) => {
          stories.push({ id: `US-${r.id}`, title: r.title, description: r.description || r.title, priority: r.priority || 'Medium' });
        });
      }
    }

    if (!stories.length) {
      stories = [
        { id: 'US-GEN-001', title: 'General system access and navigation', description: 'User can access system and navigate core modules', priority: 'High' },
        { id: 'US-GEN-002', title: 'Data creation flow', description: 'User can create data records with validation', priority: 'High' },
        { id: 'US-GEN-003', title: 'Error handling and validation', description: 'System properly validates inputs and shows errors', priority: 'Medium' },
      ];
    }

    const projectRow = projectId ? await pool.query('SELECT key_code FROM projects WHERE id = $1', [projectId]) : null;
    const finalPrefix = prefix || projectRow?.rows[0]?.key_code || 'TC';

    const scenarios = generateTestScenariosFromStories(stories, { prefix: finalPrefix, fullCoverage });
    let finalScenarios = scenarios;

    const prompt = `Given these user stories, generate comprehensive test scenarios covering functional, negative, boundary, and UI cases. Respond ONLY as JSON array [{code, title, modul_fitur, user_story_coverage, tipe_test, severity, priority, tujuan_pengujian, langkah_uji, validasi_data_uji, hasil_yang_diharapkan, user_role, steps, expected_result}].\n\nStories: ${JSON.stringify(stories.slice(0, 10))}`;
    try {
      const raw = await queryLLM(prompt, '');
      const parsed = raw ? JSON.parse(raw.replace(/```json|```/g, '').trim()) : [];
      if (Array.isArray(parsed) && parsed.length) {
        parsed.forEach((p, idx) => {
          p.code = p.code || `${finalPrefix}-AI-${idx + 1}`;
          p.langkah_uji = p.langkah_uji || p.steps || '';
          p.hasil_yang_diharapkan = p.hasil_yang_diharapkan || p.expected_result || '';
        });
        finalScenarios = [...parsed, ...scenarios];
      }
    } catch {}

    res.json({ scenarios: finalScenarios, storyCount: stories.length, scenarioCount: finalScenarios.length, userStories: stories });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to generate test scenarios.' });
  }
});

app.post('/api/test-runs', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm'), async (req, res) => {
  const { projectId, name, status = 'Planned', cycleId, testCaseIds = [], summary } = req.body || {};
  if (!projectId || !name) {
    return res.status(400).json({ message: 'Project and test run name are required.' });
  }

  try {
    const tcs = await pool.query('SELECT * FROM test_cases WHERE project_id = $1 OR id = ANY($2::int[]) LIMIT 200', [projectId, testCaseIds.length ? testCaseIds : [0]]);
    const cases = tcs.rows;
    const estimatedMinutes = cases.reduce((sum, tc) => sum + estimateTestCaseTime(tc), 0);

    const result = await pool.query(
      `INSERT INTO test_runs (project_id, name, status, created_by, planned_start, summary, estimated_minutes)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6)
       RETURNING *`,
      [projectId, name, status, req.user.sub, summary || `Test run: ${name}`, estimatedMinutes]
    );

    const runId = result.rows[0].id;
    for (const tc of cases.slice(0, 150)) {
      await pool.query(
        `INSERT INTO test_run_results (run_id, test_case_id, status) VALUES ($1, $2, 'Not Run')`,
        [runId, tc.id]
      );
    }

    const withCases = await pool.query('SELECT COUNT(*)::int AS count FROM test_run_results WHERE run_id = $1', [runId]);
    res.status(201).json({ testRun: result.rows[0], caseCount: withCases.rows[0].count, estimatedMinutes });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create test run.' });
  }
});

app.get('/api/test-runs', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT tr.*, p.name AS project_name, u.name AS created_by_name,
        (SELECT COUNT(*) FROM test_run_results t WHERE t.run_id = tr.id) AS total_cases,
        (SELECT COUNT(*) FROM test_run_results t WHERE t.run_id = tr.id AND t.status = 'Passed') AS passed,
        (SELECT COUNT(*) FROM test_run_results t WHERE t.run_id = tr.id AND t.status = 'Failed') AS failed
      FROM test_runs tr
      LEFT JOIN projects p ON p.id = tr.project_id
      LEFT JOIN users u ON u.id = tr.created_by
      ORDER BY tr.updated_at DESC
    `);
    res.json({ testRuns: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch test runs.' });
  }
});

app.get('/api/test-cycles', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT tc.*, p.name AS project_name, u.name AS owner_name,
        (SELECT COUNT(*) FROM cycle_cases c WHERE c.cycle_id = tc.id) AS total_cases
      FROM test_cycles tc
      LEFT JOIN projects p ON p.id = tc.project_id
      LEFT JOIN users u ON u.id = tc.owner_id
      ORDER BY tc.updated_at DESC
    `);
    res.json({ cycles: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch test cycles.' });
  }
});

app.post('/api/test-cycles', requireAuth, requireRoles('qa_lead', 'pm'), async (req, res) => {
  const { projectId, name, status = 'Planned', ownerId, summary } = req.body || {};
  if (!projectId || !name) {
    return res.status(400).json({ message: 'Project and cycle name are required.' });
  }

  try {
    const tcs = await pool.query('SELECT * FROM test_cases WHERE project_id = $1 LIMIT 200', [projectId]);
    const estimatedMinutes = tcs.rows.reduce((sum, tc) => sum + estimateTestCaseTime(tc), 0);

    const result = await pool.query(
      `INSERT INTO test_cycles (project_id, name, status, owner_id, summary, planned_start, planned_end, estimated_minutes)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '7 days', $6)
       RETURNING *`,
      [projectId, name, status, ownerId || req.user.sub, summary || '', estimatedMinutes]
    );
    res.status(201).json({ cycle: result.rows[0], estimatedMinutes });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create test cycle.' });
  }
});

app.get('/api/executions', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cc.id, cc.status, cc.notes, cc.executed_at,
             tc.id AS test_case_id, tc.code, tc.title, tc.status AS test_status, tc.severity, tc.priority,
             tc.modul_fitur, tc.tipe_test, tc.user_story_coverage, tc.pic_qa,
             cyc.name AS cycle_name, p.name AS project_name, u.name AS assignee_name
      FROM cycle_cases cc
      LEFT JOIN test_cases tc ON tc.id = cc.test_case_id
      LEFT JOIN test_cycles cyc ON cyc.id = cc.cycle_id
      LEFT JOIN projects p ON p.id = cyc.project_id
      LEFT JOIN users u ON u.id = cc.assignee_id
      ORDER BY cc.executed_at DESC NULLS LAST, cc.created_at DESC
    `);
    res.json({ executions: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch execution board.' });
  }
});

app.get('/api/defects', requireAuth, async (req, res) => {
  try {
    const { projectId, status, severity, priority, assigneeId, reporterId, environment } = req.query;
    const filters = [];
    const params = [];
    let q = `
      SELECT d.*, p.name AS project_name, u.name AS assignee_name, r.name AS reporter_name,
             tc.code AS test_case_code, tc.title AS test_case_title
      FROM defects d
      LEFT JOIN projects p ON p.id = d.project_id
      LEFT JOIN users u ON u.id = d.assignee_id
      LEFT JOIN users r ON r.id = d.reporter_id
      LEFT JOIN test_cases tc ON tc.id = d.linked_test_case_id
      WHERE 1=1
    `;
    if (projectId) { filters.push(`d.project_id = $${params.length + 1}`); params.push(projectId); }
    if (status) { filters.push(`d.status = $${params.length + 1}`); params.push(status); }
    if (severity) { filters.push(`d.severity = $${params.length + 1}`); params.push(severity); }
    if (priority) { filters.push(`d.priority = $${params.length + 1}`); params.push(priority); }
    if (assigneeId) { filters.push(`d.assignee_id = $${params.length + 1}`); params.push(assigneeId); }
    if (reporterId) { filters.push(`d.reporter_id = $${params.length + 1}`); params.push(reporterId); }
    if (environment) { filters.push(`d.environment ILIKE $${params.length + 1}`); params.push(`%${environment}%`); }
    if (filters.length) q += ` AND ${filters.join(' AND ')}`;
    q += ` ORDER BY d.updated_at DESC`;

    const result = await pool.query(q, params);
    res.json({ defects: result.rows, workflow: DEFECT_WORKFLOW });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch defects.' });
  }
});

app.patch('/api/defects/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body || {};
  if (!status || !DEFECT_WORKFLOW.includes(status)) {
    return res.status(400).json({ message: 'A valid defect status is required.' });
  }

  try {
    const result = await pool.query(
      `UPDATE defects
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Defect not found.' });
    }

    res.json({ defect: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to update defect status.' });
  }
});

app.post('/api/defects', requireAuth, requireRoles('qa_lead', 'qa_engineer'), async (req, res) => {
  const { projectId, title, description, severity = 'Major', priority = 'Medium', assigneeId, linkedTestCaseId, environment, stepsToReproduce } = req.body || {};
  if (!projectId || !title) {
    return res.status(400).json({ message: 'Project and title are required.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO defects (project_id, title, description, severity, priority, status, assignee_id, reporter_id, linked_test_case_id, environment, steps_to_reproduce)
       VALUES ($1,$2,$3,$4,$5,'Open',$6,$7,$8,$9,$10)
       RETURNING *`,
      [projectId, title, description || '', severity, priority, assigneeId || null, req.user.sub, linkedTestCaseId || null, environment || 'SIT', stepsToReproduce || '']
    );
    res.status(201).json({ defect: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create defect.' });
  }
});

app.get('/api/admin/permissions', requireAuth, requireRoles('qa_lead'), async (req, res) => {
  try {
    const userResult = await pool.query('SELECT * FROM users ORDER BY name ASC');
    res.json({
      rolePermissions: ROLE_PERMISSIONS,
      roles: Object.entries(ROLE_LABELS).map(([key, value]) => ({ value: key, label: value })),
      users: userResult.rows.map(sanitizeUser),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch admin role data.' });
  }
});

app.patch('/api/admin/users/:id/role', requireAuth, requireRoles('qa_lead'), async (req, res) => {
  const { role } = req.body || {};
  if (!role || !ROLE_LABELS[role]) {
    return res.status(400).json({ message: 'A valid role is required.' });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [role, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ user: sanitizeUser(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to update role.' });
  }
});

app.get('/api/reports/advanced', requireAuth, async (req, res) => {
  try {
    const { projectId, cycleId, runId, from, to } = req.query;
    const filterP = projectId ? 'WHERE project_id = $1' : '';
    const paramsP = projectId ? [projectId] : [];

    const [totalTC, passedTC, failedTC, draftTC, reviewTC, byStatus, bySeverity, byPriority, byTipeTest, byStatusSIT, totalDef, openDef, resolvedDef, byDefStatus, byDefSeverity, byDefPriority] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM test_cases ${filterP}`, paramsP),
      pool.query(`SELECT COUNT(*)::int AS total FROM test_cases ${filterP ? filterP + ' AND ' : 'WHERE '} status = 'Passed'`, paramsP),
      pool.query(`SELECT COUNT(*)::int AS total FROM test_cases ${filterP ? filterP + ' AND ' : 'WHERE '} status = 'Failed'`, paramsP),
      pool.query(`SELECT COUNT(*)::int AS total FROM test_cases ${filterP ? filterP + ' AND ' : 'WHERE '} status = 'Draft'`, paramsP),
      pool.query(`SELECT COUNT(*)::int AS total FROM test_cases ${filterP ? filterP + ' AND ' : 'WHERE '} status = 'Review'`, paramsP),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM test_cases ${projectId ? 'WHERE project_id = $1' : ''} GROUP BY status ORDER BY count DESC`, projectId ? [projectId] : []),
      pool.query(`SELECT severity, COUNT(*)::int AS count FROM test_cases ${projectId ? 'WHERE project_id = $1' : ''} GROUP BY severity ORDER BY count DESC`, projectId ? [projectId] : []),
      pool.query(`SELECT priority, COUNT(*)::int AS count FROM test_cases ${projectId ? 'WHERE project_id = $1' : ''} GROUP BY priority ORDER BY count DESC`, projectId ? [projectId] : []),
      pool.query(`SELECT tipe_test, COUNT(*)::int AS count FROM test_cases ${projectId ? 'WHERE project_id = $1' : ''} GROUP BY tipe_test ORDER BY count DESC NULLS LAST`, projectId ? [projectId] : []),
      pool.query(`SELECT status_sit, COUNT(*)::int AS count FROM test_cases ${projectId ? 'WHERE project_id = $1' : ''} GROUP BY status_sit ORDER BY count DESC NULLS LAST`, projectId ? [projectId] : []),
      pool.query(`SELECT COUNT(*)::int AS total FROM defects ${filterP}`, paramsP),
      pool.query(`SELECT COUNT(*)::int AS total FROM defects ${filterP ? filterP + ' AND ' : 'WHERE '} status IN ('Open','In Progress','In Review')`, paramsP),
      pool.query(`SELECT COUNT(*)::int AS total FROM defects ${filterP ? filterP + ' AND ' : 'WHERE '} status IN ('Resolved','Closed')`, paramsP),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM defects ${projectId ? 'WHERE project_id = $1' : ''} GROUP BY status ORDER BY count DESC`, projectId ? [projectId] : []),
      pool.query(`SELECT severity, COUNT(*)::int AS count FROM defects ${projectId ? 'WHERE project_id = $1' : ''} GROUP BY severity ORDER BY count DESC`, projectId ? [projectId] : []),
      pool.query(`SELECT priority, COUNT(*)::int AS count FROM defects ${projectId ? 'WHERE project_id = $1' : ''} GROUP BY priority ORDER BY count DESC`, projectId ? [projectId] : []),
    ]);

    const tcr = await pool.query('SELECT * FROM test_cases LIMIT 100');
    const totalEstimate = tcr.rows.reduce((sum, tc) => sum + estimateTestCaseTime(tc), 0);

    const traceability = [];
    const reqs = await pool.query(`SELECT r.*, p.name AS project_name FROM requirements r LEFT JOIN projects p ON p.id=r.project_id ${projectId ? 'WHERE r.project_id = $1' : ''} ORDER BY r.id DESC LIMIT 30`, projectId ? [projectId] : []);
    for (const req of reqs.rows) {
      const linked = await pool.query(`SELECT COUNT(*)::int AS count FROM test_cases WHERE requirement_id = $1 OR user_story_coverage ILIKE $2`, [req.id, `%${req.id}%`]);
      const defects = await pool.query(`SELECT COUNT(*)::int AS count FROM defects d JOIN test_cases tc ON tc.id = d.linked_test_case_id WHERE tc.requirement_id = $1`, [req.id]);
      traceability.push({
        requirementId: req.id,
        requirementTitle: req.title,
        projectName: req.project_name,
        priority: req.priority,
        status: req.status,
        testCasesLinked: linked.rows[0].count,
        defectsFound: defects.rows[0].count,
        coveragePercent: Math.min(100, Math.round((linked.rows[0].count / Math.max(1, 2)) * 100)),
      });
    }

    res.json({
      xrayFilters: {
        projects: (await pool.query('SELECT id, name, key_code FROM projects ORDER BY name')).rows,
        users: (await pool.query('SELECT id, name, role FROM users WHERE active = TRUE ORDER BY name')).rows,
        tipeTestOptions: TIPE_TEST_OPTIONS,
        userRoleOptions: USER_ROLE_OPTIONS,
        defectWorkflow: DEFECT_WORKFLOW,
      },
      summary: {
        testCasesTotal: totalTC.rows[0].total,
        testCasesPassed: passedTC.rows[0].total,
        testCasesFailed: failedTC.rows[0].total,
        testCasesDraft: draftTC.rows[0].total,
        testCasesReview: reviewTC.rows[0].total,
        defectsTotal: totalDef.rows[0].total,
        defectsOpen: openDef.rows[0].total,
        defectsResolved: resolvedDef.rows[0].total,
        passRate: totalTC.rows[0].total > 0 ? Math.round(((passedTC.rows[0].total + failedTC.rows[0].total > 0 ? passedTC.rows[0].total : 0) / Math.max(1, passedTC.rows[0].total + failedTC.rows[0].total)) * 100) : 0,
        defectResolutionRate: totalDef.rows[0].total > 0 ? Math.round((resolvedDef.rows[0].total / totalDef.rows[0].total) * 100) : 0,
        estimatedTotalMinutes: totalEstimate,
      },
      byStatus: byStatus.rows,
      bySeverity: bySeverity.rows,
      byPriority: byPriority.rows,
      byTipeTest: byTipeTest.rows,
      byStatusSIT: byStatusSIT.rows,
      byDefectStatus: byDefStatus.rows,
      byDefectSeverity: byDefSeverity.rows,
      byDefectPriority: byDefPriority.rows,
      traceability,
      timeEstimate: {
        totalMinutes: totalEstimate,
        totalHours: +(totalEstimate / 60).toFixed(1),
        totalWorkingDays: +(totalEstimate / (60 * 6)).toFixed(1),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to build advanced reports.' });
  }
});

app.get('/api/reports/estimate', requireAuth, async (req, res) => {
  try {
    const { projectId, cycleId, runId } = req.query;
    let testCases = [];
    if (runId) {
      const r = await pool.query('SELECT tc.* FROM test_cases tc JOIN test_run_results rr ON rr.test_case_id = tc.id WHERE rr.run_id = $1', [runId]);
      testCases = r.rows;
    } else if (cycleId) {
      const r = await pool.query('SELECT tc.* FROM test_cases tc JOIN cycle_cases cc ON cc.test_case_id = tc.id WHERE cc.cycle_id = $1', [cycleId]);
      testCases = r.rows;
    } else if (projectId) {
      const r = await pool.query('SELECT * FROM test_cases WHERE project_id = $1', [projectId]);
      testCases = r.rows;
    } else {
      const r = await pool.query('SELECT * FROM test_cases');
      testCases = r.rows;
    }

    const perCase = testCases.map((tc) => ({
      testCaseId: tc.id,
      code: tc.code,
      title: tc.title,
      severity: tc.severity,
      stepsCount: countSteps(tc.langkah_uji || tc.steps || ''),
      estimatedMinutes: estimateTestCaseTime(tc),
    }));

    const baseMinutes = perCase.reduce((sum, p) => sum + p.estimatedMinutes, 0);
    const setupOverhead = 15 + Math.min(180, testCases.length * 2);
    const reviewOverhead = Math.round(baseMinutes * 0.15);
    const retestBuffer = Math.round(baseMinutes * 0.2);
    const totalWithBuffers = baseMinutes + setupOverhead + reviewOverhead + retestBuffer;

    res.json({
      testCaseCount: testCases.length,
      baseExecutionMinutes: baseMinutes,
      setupOverheadMinutes: setupOverhead,
      reviewAndDocumentationMinutes: reviewOverhead,
      retestBufferMinutes: retestBuffer,
      totalEstimatedMinutes: totalWithBuffers,
      totalEstimatedHours: +(totalWithBuffers / 60).toFixed(2),
      estimatedWorkingDays: +(totalWithBuffers / (60 * 6)).toFixed(2),
      optimisticHours: +(baseMinutes / 60).toFixed(2),
      pessimisticHours: +((totalWithBuffers * 1.3) / 60).toFixed(2),
      perCase,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to compute test time estimate.' });
  }
});

app.get('/api/reports/pdf', requireAuth, async (req, res) => {
  try {
    const { projectId = '', reportType = 'summary' } = req.query;

    const adv = await (await fetch(`${config.frontendUrl?.replace('5173', '4000') || 'http://localhost:4000'}/api/reports/advanced${projectId ? '?projectId=' + projectId : ''}`, {
      headers: { Authorization: req.headers.authorization || '' },
    })).json().catch(() => ({ summary: {}, traceability: [], byStatus: [], bySeverity: [], byDefectStatus: [] }));
    const s = adv.summary || {};

    const doc = new PDFDocument({ margin: 40, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="tcms-report-${Date.now()}.pdf"`);
      res.send(pdfBuffer);
    });

    doc.fontSize(22).fillColor('#1e3a8a').text('TCMS QA Report', { align: 'center' });
    doc.fontSize(10).fillColor('#475569').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#1e40af').rect(doc.x, doc.y, 60, 2).fill('#1e40af');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#1e3a8a').text('Executive Summary');
    doc.moveDown(0.5);
    const summaryItems = [
      ['Total Test Cases', s.testCasesTotal || 0],
      ['Passed', s.testCasesPassed || 0],
      ['Failed', s.testCasesFailed || 0],
      ['Pass Rate', `${s.passRate || 0}%`],
      ['Total Defects', s.defectsTotal || 0],
      ['Open Defects', s.defectsOpen || 0],
      ['Resolved Defects', s.defectsResolved || 0],
      ['Resolution Rate', `${s.defectResolutionRate || 0}%`],
      ['Est. Effort (hours)', s.estimatedTotalMinutes ? +((s.estimatedTotalMinutes || 0) / 60).toFixed(1) : 'N/A'],
    ];
    summaryItems.forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#334155').text(`${label}:`, { continued: true, width: 220 });
      doc.fillColor('#0f172a').fontSize(10).text(`${value}`);
    });

    doc.moveDown(1);
    doc.fontSize(14).fillColor('#1e40af').rect(doc.x, doc.y, 60, 2).fill('#1e40af');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#1e3a8a').text('Test Cases by Status');
    doc.moveDown(0.3);
    (adv.byStatus || []).forEach((item) => {
      doc.fontSize(10).fillColor('#334155').text(`• ${item.status}: ${item.count}`);
    });

    doc.addPage();
    doc.fontSize(14).fillColor('#1e3a8a').text('Defects by Status');
    doc.moveDown(0.3);
    (adv.byDefectStatus || []).forEach((item) => {
      doc.fontSize(10).fillColor('#334155').text(`• ${item.status}: ${item.count}`);
    });

    doc.moveDown(1);
    doc.fontSize(14).fillColor('#1e3a8a').text('Traceability Matrix (Requirements → Coverage)');
    doc.moveDown(0.4);
    const tableTop = doc.y;
    let y = tableTop;
    const colX = [40, 200, 400, 480];
    doc.fontSize(9).fillColor('#ffffff').rect(40, y, 500, 18).fill('#1e3a8a');
    doc.text('Requirement', colX[0] + 4, y + 5);
    doc.text('Project', colX[1] + 4, y + 5);
    doc.text('TC Linked', colX[2] + 4, y + 5);
    doc.text('Coverage', colX[3] + 4, y + 5);
    y += 20;
    (adv.traceability || []).slice(0, 30).forEach((t, idx) => {
      if (y > 760) { doc.addPage(); y = 50; }
      doc.fillColor(idx % 2 ? '#f1f5f9' : '#ffffff').rect(40, y, 500, 16).fill(idx % 2 ? '#f1f5f9' : '#ffffff');
      doc.fillColor('#0f172a').fontSize(8);
      doc.text(String(t.requirementTitle || '').slice(0, 30), colX[0] + 4, y + 4);
      doc.text(String(t.projectName || '').slice(0, 20), colX[1] + 4, y + 4);
      doc.text(`${t.testCasesLinked || 0}`, colX[2] + 4, y + 4);
      doc.text(`${t.coveragePercent || 0}%`, colX[3] + 4, y + 4);
      y += 17;
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to generate PDF report.' });
  }
});

app.get('/api/dashboard/overview', requireAuth, async (req, res) => {
  try {
    const [projectCount, testCaseCount, openDefects, passedCases, failedCases, totalRuns] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM projects'),
      pool.query('SELECT COUNT(*)::int AS total FROM test_cases'),
      pool.query('SELECT COUNT(*)::int AS total FROM defects WHERE status IN (\'Open\', \'In Progress\', \'In Review\')'),
      pool.query('SELECT COUNT(*)::int AS total FROM test_cases WHERE status = \'Passed\''),
      pool.query('SELECT COUNT(*)::int AS total FROM test_cases WHERE status = \'Failed\''),
      pool.query('SELECT COUNT(*)::int AS total FROM test_runs'),
    ]);

    const latestCases = await pool.query(`
      SELECT tc.*, p.name AS project_name
      FROM test_cases tc
      LEFT JOIN projects p ON p.id = tc.project_id
      ORDER BY tc.updated_at DESC
      LIMIT 5
    `);

    const byStatus = await pool.query(`
      SELECT status, COUNT(*)::int AS count
      FROM test_cases
      GROUP BY status
      ORDER BY count DESC
    `);

    const bySeverity = await pool.query(`
      SELECT severity, COUNT(*)::int AS count
      FROM test_cases
      GROUP BY severity
      ORDER BY count DESC
    `);

    const nextSprint = await pool.query(`
      SELECT tr.name, tr.status, tr.estimated_minutes, p.name AS project_name
      FROM test_runs tr
      LEFT JOIN projects p ON p.id = tr.project_id
      ORDER BY tr.created_at DESC
      LIMIT 3
    `);

    res.json({
      summary: {
        projects: projectCount.rows[0].total,
        testCases: testCaseCount.rows[0].total,
        openDefects: openDefects.rows[0].total,
        passedCases: passedCases.rows[0].total,
        failedCases: failedCases.rows[0].total,
        testRuns: totalRuns.rows[0].total,
      },
      byStatus: byStatus.rows,
      bySeverity: bySeverity.rows,
      latestCases: latestCases.rows,
      nextSprint: nextSprint.rows,
      advancedConfig: {
        tipeTestOptions: TIPE_TEST_OPTIONS,
        userRoleOptions: USER_ROLE_OPTIONS,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to build dashboard overview.' });
  }
});

async function startServer() {
  await initializeDatabase();

  app.listen(config.port, () => {
    console.log(`TCMS API listening on port ${config.port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
