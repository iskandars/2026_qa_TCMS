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
app.use('/uploads', express.static(uploadDir));

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

// Generic attachment uploader — accepts any file type (evidence, screenshots, logs).
const uploadAny = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const ROLE_LABELS = {
  qa_lead: 'QA Lead',
  qa_engineer: 'QA Engineer',
  product: 'Product',
  pm: 'PM',
  business_analyst: 'Business Analyst',
};

const ROLE_PERMISSIONS = {
  qa_lead: ['read', 'write', 'approve', 'manage_users', 'bulk_import', 'generate_scenarios', 'export_reports', 'upload_requirements', 'manage_cycles', 'manage_projects'],
  qa_engineer: ['read', 'write', 'execute', 'bulk_import', 'export_reports', 'upload_requirements'],
  product: ['read', 'write', 'approve', 'export_reports', 'upload_requirements'],
  pm: ['read', 'write', 'approve', 'manage_cycles', 'export_reports', 'upload_requirements', 'manage_projects'],
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

function safeInt(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function safeDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s || s === '-' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'null') return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
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
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const stories = [];
  let storyIndex = 1;

  lines.forEach((line) => {
    const lower = line.toLowerCase();
    if (
      lower.startsWith('user story') ||
      lower.startsWith('us-') ||
      lower.includes('as a') ||
      lower.includes('sebagai') ||
      lower.includes('want to') ||
      lower.includes('ingin') ||
      lower.includes('fitur') ||
      lower.includes('feature') ||
      lower.includes('kebutuhan') ||
      lower.includes('requirement') ||
      lower.includes('modul') ||
      lower.includes('module')
    ) {
      const cleanTitle = line.replace(/^[#*\-•\d.]+\s*/, '').trim();
      if (cleanTitle.length > 5) {
        stories.push({
          id: `US-${String(storyIndex++).padStart(3, '0')}`,
          title: cleanTitle.length > 200 ? cleanTitle.slice(0, 200) + '...' : cleanTitle,
          description: cleanTitle,
          priority: storyIndex <= 3 ? 'High' : storyIndex <= 6 ? 'Medium' : 'Low',
        });
      }
    }
  });

  if (stories.length === 0) {
    lines.forEach((line) => {
      const cleanTitle = line.replace(/^[#*\-•\d.]+\s*/, '').trim();
      if (cleanTitle.length >= 20 && cleanTitle.length <= 300) {
        stories.push({
          id: `US-${String(storyIndex++).padStart(3, '0')}`,
          title: cleanTitle.length > 200 ? cleanTitle.slice(0, 200) + '...' : cleanTitle,
          description: cleanTitle,
          priority: storyIndex <= 3 ? 'High' : storyIndex <= 6 ? 'Medium' : 'Low',
        });
      }
    });
  }

  return stories.slice(0, 50);
}

function generateTestScenariosFromStories(stories, projectContext = {}) {
  const scenarios = [];
  const countPerStory = projectContext.fullCoverage ? 6 : 4;
  stories.forEach((story, sIdx) => {
    const variants = [
      { title: `[Positive] Happy path user journey - ${story.title}`, tipe: 'Functional', severity: 'Critical' },
      { title: `[Negative] Invalid input & validation failure - ${story.title}`, tipe: 'Functional', severity: 'Major' },
      { title: `[Boundary] Min/Max limits & special chars - ${story.title}`, tipe: 'Functional', severity: 'Medium' },
      { title: `[UI/UX] Field states & accessibility verification - ${story.title}`, tipe: 'UI', severity: 'Minor' },
      { title: `[API/Integration] Backend contract & data persistence - ${story.title}`, tipe: 'API', severity: 'Major' },
      { title: `[Security] Role-based access & token validation - ${story.title}`, tipe: 'Security', severity: 'Critical' },
    ];
    variants.slice(0, countPerStory).forEach((v, vIdx) => {
      scenarios.push({
        code: `${projectContext.prefix || 'TC'}-${(sIdx * 10) + vIdx + 1}`,
        title: v.title,
        modul_fitur: story.title.slice(0, 200),
        user_story_coverage: story.id,
        tipe_test: v.tipe,
        severity: v.severity,
        tujuan_pengujian: `Verify that user story ${story.id}: ${story.title} works correctly under ${v.tipe.toLowerCase()} test conditions.`,
        langkah_uji: `1. Navigate to the feature related to ${story.title}\n2. Prepare test data for ${v.tipe.toLowerCase()} scenario\n3. Execute the flow described in requirement\n4. Observe system behavior and outputs\n5. Record any deviations from expected behavior`,
        validasi_data_uji: `Input validation: valid & invalid formats, boundary values (min/max length, null/empty, special characters). Output validation: data integrity, field mappings, error messages, audit trail.`,
        hasil_yang_diharapkan: `System should handle scenario correctly: valid inputs succeed with proper confirmation; invalid inputs are rejected with clear user-friendly error messages and no data corruption.`,
        user_role: USER_ROLE_OPTIONS[sIdx % USER_ROLE_OPTIONS.length],
        pic_qa: 'QA Team',
        test_scenario_version: '1.0',
        status: 'Draft',
        priority: story.priority,
        steps: `1. Navigate to the feature related to ${story.title}\n2. Prepare test data for ${v.tipe.toLowerCase()} scenario\n3. Execute the flow described in requirement\n4. Observe system behavior and outputs\n5. Record any deviations from expected behavior`,
        expected_result: `System should handle scenario correctly: valid inputs succeed with proper confirmation; invalid inputs are rejected with clear user-friendly error messages and no data corruption.`,
        summary: v.title,
      });
    });
  });
  return scenarios;
}

async function parsePdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);

    // 1. Check pdf-parse v2+ PDFParse class
    const PDFParseClass = pdfParseModule.PDFParse || (pdfParseModule.default && pdfParseModule.default.PDFParse);
    if (typeof PDFParseClass === 'function') {
      const parser = new PDFParseClass({ data: dataBuffer });
      const res = await parser.getText();
      if (res && typeof res.text === 'string' && res.text.trim()) {
        return res.text;
      }
    }

    // 2. Check pdf-parse v1 default export function
    const pdfFn = pdfParseModule.default || pdfParseModule;
    if (typeof pdfFn === 'function' && pdfFn !== PDFParseClass) {
      const res = await pdfFn(dataBuffer);
      if (res && res.text) return res.text;
    }

    // 3. Fallback to clean readable string extraction from buffer
    const rawStr = dataBuffer.toString('utf-8');
    const printable = rawStr.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
    if (printable.length > 50) return printable;

    return `PDF requirement document processed successfully: ${path.basename(filePath)}`;
  } catch (err) {
    console.error('Error in parsePdf:', err);
    return `PDF requirement document processed: ${path.basename(filePath)} (Extraction note: ${err.message})`;
  }
}

function convertPdfToMarkdown(pdfText, fileName, userStories = [], projectInfo = {}) {
  const docTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const dateStr = new Date().toISOString().split('T')[0];

  let md = `# Requirement Specification: ${docTitle}\n\n`;
  md += `**Document Name:** \`${fileName}\`  \n`;
  md += `**Converted Date:** ${dateStr}  \n`;
  if (projectInfo.name) md += `**Project:** ${projectInfo.name}  \n`;
  md += `**Identified User Stories:** ${userStories.length}  \n\n`;

  md += `---\n\n`;
  md += `## 1. Executive Summary & Overview\n\n`;
  const overview = pdfText.slice(0, 1500).trim() || 'Requirement specification extracted from uploaded document.';
  md += `${overview}\n\n`;

  md += `## 2. Extracted User Stories & Acceptance Criteria\n\n`;
  if (userStories.length > 0) {
    md += `| Story ID | Priority | User Story / Feature Title | Description & Acceptance Criteria |\n`;
    md += `|---|---|---|---|\n`;
    userStories.forEach((s) => {
      const id = s.id || 'US';
      const prio = s.priority || 'Medium';
      const title = (s.title || '').replace(/\|/g, '\\|');
      const desc = (s.description || s.title || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      md += `| **${id}** | ${prio} | ${title} | ${desc} |\n`;
    });
    md += `\n`;
  } else {
    md += `*No discrete user stories identified in initial parsing. Default requirements apply.*\n\n`;
  }

  md += `## 3. Test Coverage Strategy & Scenario Generation Matrix\n\n`;
  md += `This requirement document has been structured for **100% full-coverage test scenario generation** across:\n`;
  md += `- **Functional Happy Path (Positive):** End-to-end user workflows and valid inputs.\n`;
  md += `- **Functional Edge Cases & Error Handling (Negative):** Invalid field inputs and exception paths.\n`;
  md += `- **Boundary Value Analysis:** Minimum, maximum, and extreme data conditions.\n`;
  md += `- **UI & Field Validation:** Responsive layout, labels, and error message feedback.\n`;
  md += `- **API & Integration:** Data contract integrity, request/response structures, and status codes.\n`;
  md += `- **Security & Authorization:** Role-based access control (RBAC) and permission checks.\n\n`;

  md += `## 4. Full Extracted Requirement Text\n\n`;
  md += `\`\`\`text\n${pdfText.slice(0, 12000)}\n\`\`\`\n`;

  return md;
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
  res.json({ status: 'ok', message: 'BINA QA TCMS API running', timestamp: new Date().toISOString() });
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

app.post('/api/users', requireAuth, requireRoles('qa_lead'), async (req, res) => {
  const { name, email, password, role, department } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Name is required.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ message: 'A valid email is required.' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  if (!role || !ROLE_LABELS[role]) {
    return res.status(400).json({ message: 'A valid role is required.' });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, department, active, sso_provider)
       VALUES ($1, $2, $3, $4, $5, TRUE, 'local')
       RETURNING *`,
      [String(name).trim(), normalizedEmail, passwordHash, role, department ? String(department).trim() : null]
    );

    await logActivity(req.user.sub, 'user', result.rows[0].id, 'create', `${result.rows[0].name} (${ROLE_LABELS[role]})`);

    res.status(201).json({ user: sanitizeUser(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create user.' });
  }
});

app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.name AS owner_name,
        (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id) AS test_cases_count,
        (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id AND (tc.status = 'Passed' OR tc.status_sit = 'Passed')) AS passed_count,
        (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id AND (tc.status = 'Failed' OR tc.status_sit = 'Failed')) AS failed_count,
        (SELECT COUNT(*)::int FROM requirements r WHERE r.project_id = p.id) AS requirements_count,
        (SELECT COUNT(*)::int FROM test_cycles cyc WHERE cyc.project_id = p.id) AS cycles_count,
        (SELECT COUNT(*)::int FROM defects d WHERE d.project_id = p.id) AS defects_count,
        (SELECT COUNT(*)::int FROM defects d WHERE d.project_id = p.id AND d.status NOT IN ('Closed', 'Resolved', 'Rejected')) AS open_defects_count
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      ORDER BY p.updated_at DESC
    `);
    res.json({ projects: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch projects.' });
  }
});

app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.name AS owner_name,
        (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id) AS test_cases_count,
        (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id AND (tc.status = 'Passed' OR tc.status_sit = 'Passed')) AS passed_count,
        (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id AND (tc.status = 'Failed' OR tc.status_sit = 'Failed')) AS failed_count,
        (SELECT COUNT(*)::int FROM requirements r WHERE r.project_id = p.id) AS requirements_count,
        (SELECT COUNT(*)::int FROM test_cycles cyc WHERE cyc.project_id = p.id) AS cycles_count,
        (SELECT COUNT(*)::int FROM defects d WHERE d.project_id = p.id) AS defects_count,
        (SELECT COUNT(*)::int FROM defects d WHERE d.project_id = p.id AND d.status NOT IN ('Closed', 'Resolved', 'Rejected')) AS open_defects_count
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.id = $1
    `, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Project not found.' });
    res.json({ project: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch project.' });
  }
});

app.post('/api/projects', requireAuth, requireRoles('qa_lead', 'pm'), async (req, res) => {
  const {
    name, keyCode, description, status = 'Active', ownerId,
    startDate, endDate, progress = 0, priority = 'Medium', budgetHours = 0,
  } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Project name is required.' });
  }
  if (!keyCode || !keyCode.trim()) {
    return res.status(400).json({ message: 'Project key is required.' });
  }

  const cleanKey = keyCode.trim().toUpperCase();

  try {
    const conflict = await pool.query('SELECT id FROM projects WHERE key_code = $1', [cleanKey]);
    if (conflict.rowCount > 0) {
      return res.status(409).json({ message: `Project key '${cleanKey}' is already taken. Please choose another key code.` });
    }

    const cleanOwner = safeInt(ownerId) || req.user.sub;
    const cleanProgress = Math.max(0, Math.min(100, safeInt(progress) || 0));
    const cleanStart = safeDate(startDate);
    const cleanEnd = safeDate(endDate);

    const result = await pool.query(
      `INSERT INTO projects (name, key_code, description, status, owner_id, start_date, end_date, progress, priority, budget_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name.trim(), cleanKey, description || '', status, cleanOwner, cleanStart, cleanEnd, cleanProgress, priority, safeInt(budgetHours) || 0]
    );

    await logActivity(req.user.sub, 'project', result.rows[0].id, 'create', result.rows[0].name);
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

    let projectInfo = {};
    if (projectId) {
      const pRes = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
      if (pRes.rows[0]) projectInfo = pRes.rows[0];
    }

    let extractedText = '';
    try {
      extractedText = await parsePdf(filePath);
    } catch (pdfErr) {
      extractedText = `PDF processing note: ${pdfErr.message}`;
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

    const markdownContent = convertPdfToMarkdown(extractedText, req.file.originalname, storiesFromLLM, projectInfo);
    const mdFileName = `${path.parse(req.file.filename).name}.md`;
    const mdFilePath = path.join(uploadDir, mdFileName);
    fs.writeFileSync(mdFilePath, markdownContent, 'utf-8');

    const docResult = await pool.query(
      `INSERT INTO requirement_documents (
        requirement_id, project_id, file_name, file_path, file_size, 
        extracted_text, rag_chunks, user_story_breakdown, uploaded_by,
        markdown_content, markdown_file_path
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        requirementId || null,
        projectId || null,
        req.file.originalname,
        filePath,
        req.file.size,
        extractedText,
        JSON.stringify(ragChunks),
        JSON.stringify(storiesFromLLM),
        req.user.sub,
        markdownContent,
        mdFilePath
      ]
    );

    const createdDoc = docResult.rows[0];

    res.status(201).json({
      document: createdDoc,
      extractedText: extractedText.slice(0, 2000),
      markdownContent,
      markdownFilePath: mdFilePath,
      downloadMdUrl: `/api/requirement-documents/${createdDoc.id}/download-md`,
      ragChunkCount: ragChunks.length,
      userStories: storiesFromLLM,
    });
  } catch (error) {
    console.error('Error in upload-pdf:', error);
    res.status(500).json({ message: error.message || 'Unable to process PDF upload.' });
  }
});

app.get('/api/requirement-documents/:id/download-md', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requirement_documents WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Requirement document not found.' });
    const doc = result.rows[0];
    const fileName = `${path.parse(doc.file_name).name}.md`;

    if (doc.markdown_file_path && fs.existsSync(doc.markdown_file_path)) {
      return res.download(doc.markdown_file_path, fileName);
    }
    if (doc.markdown_content) {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(doc.markdown_content);
    }
    res.status(404).json({ message: 'Markdown content is not available for this document.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to download Markdown document.' });
  }
});

app.get('/api/requirement-documents/:id/download-pdf', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requirement_documents WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Requirement document not found.' });
    const doc = result.rows[0];
    if (doc.file_path && fs.existsSync(doc.file_path)) {
      return res.download(doc.file_path, doc.file_name);
    }
    res.status(404).json({ message: 'PDF file is not available on disk.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to download PDF file.' });
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
        api_version, test_scenario_version, requirement_id, suite_id, milestone_id, preconditions
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
      RETURNING *`,
      [
        safeInt(body.projectId), body.code, body.title, body.summary || '', body.status || 'Draft', body.severity || 'Medium',
        body.priority || 'Medium', safeInt(body.assigneeId), req.user.sub, body.tags || '', body.steps || body.langkah_uji || '',
        body.expectedResult || body.hasil_yang_diharapkan || '', body.modulFitur || body.modul_fitur || '',
        body.userStoryCoverage || body.user_story_coverage || '', body.tipeTest || body.tipe_test || 'Functional',
        body.userRole || body.user_role || '', body.tujuanPengujian || body.tujuan_pengujian || '',
        body.langkahUji || body.langkah_uji || body.steps || '',
        body.validasiDataUji || body.validasi_data_uji || '',
        body.hasilYangDiharapkan || body.hasil_yang_diharapkan || body.expectedResult || '',
        body.picQA || body.pic_qa || '', body.statusSIT || body.status_sit || 'Not Started',
        safeDate(body.dateSITExecuted || body.date_sit_executed), safeDate(body.dateSITDone || body.date_sit_done),
        body.objectTestVersion || body.object_test_version || '', body.apiVersion || body.api_version || '',
        body.testScenarioVersion || body.test_scenario_version || '', safeInt(body.requirementId || body.requirement_id),
        safeInt(body.suiteId || body.suite_id), safeInt(body.milestoneId || body.milestone_id),
        body.preconditions || '',
      ]
    );

    await logActivity(req.user.sub, 'test_case', result.rows[0].id, 'create', result.rows[0].code);
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
          safeDate(row['Date SIT Executed'] || row.date_sit_executed),
          safeDate(row['Date SIT Done'] || row.date_sit_done),
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
    let casesQuery;
    let casesParams;
    if (Array.isArray(testCaseIds) && testCaseIds.length > 0) {
      casesQuery = 'SELECT * FROM test_cases WHERE id = ANY($1::int[]) AND project_id = $2 ORDER BY id ASC LIMIT 200';
      casesParams = [testCaseIds, safeInt(projectId)];
    } else {
      casesQuery = 'SELECT * FROM test_cases WHERE project_id = $1 ORDER BY id ASC LIMIT 200';
      casesParams = [safeInt(projectId)];
    }
    const tcs = await pool.query(casesQuery, casesParams);
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
      SELECT tc.*, p.name AS project_name, u.name AS owner_name, tp.name AS plan_name,
        (SELECT COUNT(*) FROM cycle_cases c WHERE c.cycle_id = tc.id) AS total_cases,
        (SELECT COUNT(*) FROM cycle_cases c WHERE c.cycle_id = tc.id AND c.status = 'Passed') AS passed_cases,
        (SELECT COUNT(*) FROM cycle_cases c WHERE c.cycle_id = tc.id AND c.status = 'Failed') AS failed_cases
      FROM test_cycles tc
      LEFT JOIN projects p ON p.id = tc.project_id
      LEFT JOIN users u ON u.id = tc.owner_id
      LEFT JOIN test_plans tp ON tp.id = tc.plan_id
      ORDER BY tc.updated_at DESC
    `);
    res.json({ cycles: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch test cycles.' });
  }
});

app.post('/api/test-cycles', requireAuth, requireRoles('qa_lead', 'pm'), async (req, res) => {
  const { projectId, name, status = 'Planned', ownerId, summary, planId, testCaseIds } = req.body || {};
  if (!projectId || !name) {
    return res.status(400).json({ message: 'Project and cycle name are required.' });
  }

  try {
    const tcs = await pool.query('SELECT * FROM test_cases WHERE project_id = $1 LIMIT 200', [projectId]);
    const estimatedMinutes = tcs.rows.reduce((sum, tc) => sum + estimateTestCaseTime(tc), 0);

    const result = await pool.query(
      `INSERT INTO test_cycles (project_id, name, status, owner_id, summary, planned_start, planned_end, estimated_minutes, plan_id)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '7 days', $6, $7)
       RETURNING *`,
      [projectId, name, status, ownerId || req.user.sub, summary || '', estimatedMinutes, planId || null]
    );

    const cycleId = result.rows[0].id;
    const selected = Array.isArray(testCaseIds) && testCaseIds.length
      ? tcs.rows.filter((tc) => testCaseIds.map(Number).includes(tc.id))
      : tcs.rows;

    for (const tc of selected.slice(0, 150)) {
      await pool.query(
        `INSERT INTO cycle_cases (cycle_id, test_case_id, status, assignee_id) VALUES ($1, $2, 'Not Executed', $3)`,
        [cycleId, tc.id, tc.assignee_id || req.user.sub]
      );
    }

    await logActivity(req.user.sub, 'test_cycle', cycleId, 'create', name);
    res.status(201).json({ cycle: result.rows[0], estimatedMinutes, caseCount: selected.length });
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

async function getAdvancedReportData(projectId) {
  const cleanProjectId = safeInt(projectId);
  const filterP = cleanProjectId ? 'WHERE project_id = $1' : '';
  const paramsP = cleanProjectId ? [cleanProjectId] : [];

  const [
    totalTC, passedTC, failedTC, draftTC, reviewTC,
    byStatus, bySeverity, byPriority, byTipeTest, byStatusSIT,
    totalDef, openDef, resolvedDef, byDefStatus, byDefSeverity, byDefPriority,
    projectsResult, cyclesResult,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM test_cases ${filterP}`, paramsP),
    pool.query(`SELECT COUNT(*)::int AS total FROM test_cases ${filterP ? filterP + ' AND ' : 'WHERE '} (status = 'Passed' OR status_sit = 'Passed')`, paramsP),
    pool.query(`SELECT COUNT(*)::int AS total FROM test_cases ${filterP ? filterP + ' AND ' : 'WHERE '} (status = 'Failed' OR status_sit = 'Failed')`, paramsP),
    pool.query(`SELECT COUNT(*)::int AS total FROM test_cases ${filterP ? filterP + ' AND ' : 'WHERE '} status = 'Draft'`, paramsP),
    pool.query(`SELECT COUNT(*)::int AS total FROM test_cases ${filterP ? filterP + ' AND ' : 'WHERE '} status = 'Review'`, paramsP),
    pool.query(`SELECT COALESCE(status, 'Draft') as status, COUNT(*)::int AS count FROM test_cases ${cleanProjectId ? 'WHERE project_id = $1' : ''} GROUP BY status ORDER BY count DESC`, cleanProjectId ? [cleanProjectId] : []),
    pool.query(`SELECT COALESCE(severity, 'Medium') as severity, COUNT(*)::int AS count FROM test_cases ${cleanProjectId ? 'WHERE project_id = $1' : ''} GROUP BY severity ORDER BY count DESC`, cleanProjectId ? [cleanProjectId] : []),
    pool.query(`SELECT COALESCE(priority, 'Medium') as priority, COUNT(*)::int AS count FROM test_cases ${cleanProjectId ? 'WHERE project_id = $1' : ''} GROUP BY priority ORDER BY count DESC`, cleanProjectId ? [cleanProjectId] : []),
    pool.query(`SELECT COALESCE(tipe_test, 'Functional') as tipe_test, COUNT(*)::int AS count FROM test_cases ${cleanProjectId ? 'WHERE project_id = $1' : ''} GROUP BY tipe_test ORDER BY count DESC NULLS LAST`, cleanProjectId ? [cleanProjectId] : []),
    pool.query(`SELECT COALESCE(status_sit, 'Not Started') as status_sit, COUNT(*)::int AS count FROM test_cases ${cleanProjectId ? 'WHERE project_id = $1' : ''} GROUP BY status_sit ORDER BY count DESC NULLS LAST`, cleanProjectId ? [cleanProjectId] : []),
    pool.query(`SELECT COUNT(*)::int AS total FROM defects ${filterP}`, paramsP),
    pool.query(`SELECT COUNT(*)::int AS total FROM defects ${filterP ? filterP + ' AND ' : 'WHERE '} status IN ('Open','In Progress','In Review')`, paramsP),
    pool.query(`SELECT COUNT(*)::int AS total FROM defects ${filterP ? filterP + ' AND ' : 'WHERE '} status IN ('Resolved','Closed')`, paramsP),
    pool.query(`SELECT COALESCE(status, 'Open') as status, COUNT(*)::int AS count FROM defects ${cleanProjectId ? 'WHERE project_id = $1' : ''} GROUP BY status ORDER BY count DESC`, cleanProjectId ? [cleanProjectId] : []),
    pool.query(`SELECT COALESCE(severity, 'Major') as severity, COUNT(*)::int AS count FROM defects ${cleanProjectId ? 'WHERE project_id = $1' : ''} GROUP BY severity ORDER BY count DESC`, cleanProjectId ? [cleanProjectId] : []),
    pool.query(`SELECT COALESCE(priority, 'Medium') as priority, COUNT(*)::int AS count FROM defects ${cleanProjectId ? 'WHERE project_id = $1' : ''} GROUP BY priority ORDER BY count DESC`, cleanProjectId ? [cleanProjectId] : []),
    pool.query(`
      SELECT p.*, u.name AS owner_name,
        (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id) as test_cases_count,
        (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id AND (tc.status = 'Passed' OR tc.status_sit = 'Passed')) as passed_count,
        (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id AND (tc.status = 'Failed' OR tc.status_sit = 'Failed')) as failed_count,
        (SELECT COUNT(*)::int FROM defects d WHERE d.project_id = p.id AND d.status NOT IN ('Closed', 'Resolved', 'Rejected')) as open_defects_count
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      ${cleanProjectId ? 'WHERE p.id = $1' : ''}
      ORDER BY p.name ASC
    `, paramsP),
    pool.query(`
      SELECT c.*, p.name as project_name, u.name as owner_name,
        (SELECT COUNT(*)::int FROM cycle_cases cc WHERE cc.cycle_id = c.id) as total_cases,
        (SELECT COUNT(*)::int FROM cycle_cases cc WHERE cc.cycle_id = c.id AND cc.status = 'Passed') as passed_cases,
        (SELECT COUNT(*)::int FROM cycle_cases cc WHERE cc.cycle_id = c.id AND cc.status = 'Failed') as failed_cases
      FROM test_cycles c
      JOIN projects p ON p.id = c.project_id
      LEFT JOIN users u ON u.id = c.owner_id
      ${cleanProjectId ? 'WHERE c.project_id = $1' : ''}
      ORDER BY c.planned_start DESC NULLS LAST
    `, paramsP),
  ]);

  const tcr = await pool.query(`SELECT * FROM test_cases ${filterP} LIMIT 100`, paramsP);
  const totalEstimate = tcr.rows.reduce((sum, tc) => sum + estimateTestCaseTime(tc), 0);

  const reqs = await pool.query(`
    SELECT r.*, p.name AS project_name
    FROM requirements r
    LEFT JOIN projects p ON p.id = r.project_id
    ${cleanProjectId ? 'WHERE r.project_id = $1' : ''}
    ORDER BY r.id DESC LIMIT 40
  `, paramsP);

  const traceability = [];
  for (const req of reqs.rows) {
    const linked = await pool.query(`SELECT COUNT(*)::int AS count FROM test_cases WHERE requirement_id = $1 OR user_story_coverage ILIKE $2`, [req.id, `%${req.id}%`]);
    const defects = await pool.query(`SELECT COUNT(*)::int AS count FROM defects d JOIN test_cases tc ON tc.id = d.linked_test_case_id WHERE tc.requirement_id = $1`, [req.id]);
    const tcCount = linked.rows[0].count;
    traceability.push({
      requirementId: req.id,
      requirementTitle: req.title,
      projectName: req.project_name || 'General',
      priority: req.priority || 'Medium',
      status: req.status || 'Draft',
      testCasesLinked: tcCount,
      defectsFound: defects.rows[0].count,
      coveragePercent: Math.min(100, Math.round((tcCount / Math.max(1, 2)) * 100)),
    });
  }

  const tcTotal = totalTC.rows[0].total;
  const tcPassed = passedTC.rows[0].total;
  const tcFailed = failedTC.rows[0].total;
  const defTotal = totalDef.rows[0].total;
  const defOpen = openDef.rows[0].total;
  const defResolved = resolvedDef.rows[0].total;

  const testedCount = tcPassed + tcFailed;
  const passRate = testedCount > 0 ? Math.round((tcPassed / testedCount) * 100) : 0;
  const defectResolutionRate = defTotal > 0 ? Math.round((defResolved / defTotal) * 100) : 0;

  return {
    projectId: cleanProjectId,
    summary: {
      testCasesTotal: tcTotal,
      testCasesPassed: tcPassed,
      testCasesFailed: tcFailed,
      testCasesDraft: draftTC.rows[0].total,
      testCasesReview: reviewTC.rows[0].total,
      defectsTotal: defTotal,
      defectsOpen: defOpen,
      defectsResolved: defResolved,
      passRate,
      defectResolutionRate,
      estimatedTotalMinutes: totalEstimate,
    },
    projects: projectsResult.rows,
    cycles: cyclesResult.rows,
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
  };
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

app.get('/api/reports/advanced', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.query;
    const data = await getAdvancedReportData(projectId);
    res.json({
      ...data,
      xrayFilters: {
        projects: (await pool.query('SELECT id, name, key_code FROM projects ORDER BY name')).rows,
        users: (await pool.query('SELECT id, name, role FROM users WHERE active = TRUE ORDER BY name')).rows,
        tipeTestOptions: TIPE_TEST_OPTIONS,
        userRoleOptions: USER_ROLE_OPTIONS,
        defectWorkflow: DEFECT_WORKFLOW,
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
    const { projectId = '' } = req.query;
    const adv = await getAdvancedReportData(projectId);
    const s = adv.summary || {};

    const doc = new PDFDocument({ margin: 40, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bank-ina-tcms-report-${Date.now()}.pdf"`);
      res.send(pdfBuffer);
    });

    // Header banner
    doc.rect(40, 40, 520, 5).fill('#e30613');
    doc.moveDown(1);
    doc.fontSize(18).fillColor('#0b1a33').text('BANK INA DIGITAL - QA TEST MANAGEMENT REPORT', { align: 'center' });
    doc.fontSize(10).fillColor('#64748b').text(`Generated: ${new Date().toLocaleString()} | Scope: ${projectId ? 'Project #' + projectId : 'All Projects'} | User: ${req.user.email || 'Authorized'}`, { align: 'center' });
    doc.moveDown(1.2);

    // Executive Summary
    doc.fontSize(13).fillColor('#e30613').text('1. EXECUTIVE SUMMARY');
    doc.rect(40, doc.y + 2, 520, 1.5).fill('#0b1a33');
    doc.moveDown(0.6);

    const summaryItems = [
      ['Total Test Cases', String(s.testCasesTotal || 0)],
      ['Passed', `${s.testCasesPassed || 0} (${s.passRate || 0}%)`],
      ['Failed', String(s.testCasesFailed || 0)],
      ['Draft / Review', `${s.testCasesDraft || 0} / ${s.testCasesReview || 0}`],
      ['Total Defects', String(s.defectsTotal || 0)],
      ['Open Defects', String(s.defectsOpen || 0)],
      ['Resolved Defects', `${s.defectsResolved || 0} (${s.defectResolutionRate || 0}%)`],
      ['Est. Effort (hours)', s.estimatedTotalMinutes ? +((s.estimatedTotalMinutes || 0) / 60).toFixed(1) + ' hrs' : 'N/A'],
    ];

    summaryItems.forEach(([label, value]) => {
      doc.fontSize(9.5).fillColor('#1e293b').text(`• ${label}: `, { continued: true });
      doc.fillColor('#0b1a33').font('Helvetica-Bold').text(value).font('Helvetica');
    });

    doc.moveDown(1);

    // Projects Overview
    if (adv.projects && adv.projects.length) {
      doc.fontSize(13).fillColor('#e30613').text('2. PROJECTS OVERVIEW & PROGRESS');
      doc.rect(40, doc.y + 2, 520, 1.5).fill('#0b1a33');
      doc.moveDown(0.6);

      adv.projects.forEach((p) => {
        const dates = (p.start_date && p.end_date) ? ` (${p.start_date.toString().split('T')[0]} - ${p.end_date.toString().split('T')[0]})` : '';
        doc.fontSize(9.5).fillColor('#0b1a33').font('Helvetica-Bold').text(`[${p.key_code}] ${p.name}${dates}`, { continued: true });
        doc.font('Helvetica').fillColor('#64748b').text(` — Status: ${p.status} | Progress: ${p.progress || 0}% | TC: ${p.test_cases_count || 0} | Open Bugs: ${p.open_defects_count || 0}`);
      });
      doc.moveDown(1);
    }

    // Status breakdown
    doc.fontSize(13).fillColor('#e30613').text('3. TEST EXECUTION & DEFECT BREAKDOWN');
    doc.rect(40, doc.y + 2, 520, 1.5).fill('#0b1a33');
    doc.moveDown(0.6);

    doc.fontSize(10).fillColor('#0b1a33').font('Helvetica-Bold').text('Test Cases by Status:');
    doc.font('Helvetica');
    (adv.byStatus || []).forEach((item) => {
      doc.fontSize(9).fillColor('#334155').text(`   - ${item.status}: ${item.count}`);
    });
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor('#0b1a33').font('Helvetica-Bold').text('Defects by Status:');
    doc.font('Helvetica');
    (adv.byDefectStatus || []).forEach((item) => {
      doc.fontSize(9).fillColor('#334155').text(`   - ${item.status}: ${item.count}`);
    });

    // Traceability Matrix Page
    if (adv.traceability && adv.traceability.length) {
      doc.addPage();
      doc.fontSize(13).fillColor('#e30613').text('4. REQUIREMENT TRACEABILITY MATRIX');
      doc.rect(40, doc.y + 2, 520, 1.5).fill('#0b1a33');
      doc.moveDown(0.8);

      const colX = [40, 240, 360, 430, 490];
      const renderTraceHeader = (curY) => {
        doc.rect(40, curY, 520, 18).fill('#0b1a33');
        doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text('Requirement Title', colX[0] + 4, curY + 4);
        doc.text('Project', colX[1] + 4, curY + 4);
        doc.text('Priority', colX[2] + 4, curY + 4);
        doc.text('Linked TC', colX[3] + 4, curY + 4);
        doc.text('Coverage', colX[4] + 4, curY + 4);
        doc.font('Helvetica');
      };

      let y = doc.y;
      renderTraceHeader(y);
      y += 20;

      adv.traceability.slice(0, 35).forEach((t, idx) => {
        if (y > 740) {
          doc.addPage();
          y = 50;
          renderTraceHeader(y);
          y += 20;
        }
        doc.rect(40, y, 520, 16).fill(idx % 2 === 0 ? '#ffffff' : '#f8fafc');
        doc.fontSize(8.5).fillColor('#0f172a');
        doc.text(String(t.requirementTitle || '').slice(0, 35), colX[0] + 4, y + 4);
        doc.text(String(t.projectName || '').slice(0, 20), colX[1] + 4, y + 4);
        doc.text(String(t.priority || ''), colX[2] + 4, y + 4);
        doc.text(String(t.testCasesLinked || 0), colX[3] + 4, y + 4);
        doc.text(`${t.coveragePercent || 0}%`, colX[4] + 4, y + 4);
        y += 18;
      });
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to generate PDF report.' });
  }
});

app.get('/api/reports/csv', requireAuth, async (req, res) => {
  try {
    const { projectId = '' } = req.query;
    const adv = await getAdvancedReportData(projectId);
    const s = adv.summary || {};

    const lines = [];
    lines.push('=== BANK INA DIGITAL - QA TEST MANAGEMENT REPORT ===');
    lines.push(`Generated,${new Date().toISOString()}`);
    lines.push(`Scope,${projectId ? 'Project #' + projectId : 'All Projects'}`);
    lines.push(`Requested By,${escapeCsv(req.user.email)}`);
    lines.push('');

    lines.push('=== 1. EXECUTIVE SUMMARY ===');
    lines.push('Metric,Value');
    lines.push(`Total Test Cases,${s.testCasesTotal || 0}`);
    lines.push(`Passed Test Cases,${s.testCasesPassed || 0}`);
    lines.push(`Failed Test Cases,${s.testCasesFailed || 0}`);
    lines.push(`Draft Test Cases,${s.testCasesDraft || 0}`);
    lines.push(`Review Test Cases,${s.testCasesReview || 0}`);
    lines.push(`Pass Rate,${s.passRate || 0}%`);
    lines.push(`Total Defects,${s.defectsTotal || 0}`);
    lines.push(`Open Defects,${s.defectsOpen || 0}`);
    lines.push(`Resolved Defects,${s.defectsResolved || 0}`);
    lines.push(`Defect Resolution Rate,${s.defectResolutionRate || 0}%`);
    lines.push(`Estimated Effort (Hours),${s.estimatedTotalMinutes ? +((s.estimatedTotalMinutes || 0) / 60).toFixed(1) : 0}`);
    lines.push('');

    lines.push('=== 2. PROJECTS PROGRESS & HEALTH ===');
    lines.push('Project ID,Project Name,Key Code,Status,Priority,Start Date,End Date,Progress %,Total TC,Passed,Failed,Open Defects,Owner');
    (adv.projects || []).forEach((p) => {
      lines.push([
        escapeCsv(p.id),
        escapeCsv(p.name),
        escapeCsv(p.key_code),
        escapeCsv(p.status),
        escapeCsv(p.priority || 'Medium'),
        escapeCsv(p.start_date ? p.start_date.toString().split('T')[0] : ''),
        escapeCsv(p.end_date ? p.end_date.toString().split('T')[0] : ''),
        escapeCsv(`${p.progress || 0}%`),
        escapeCsv(p.test_cases_count || 0),
        escapeCsv(p.passed_count || 0),
        escapeCsv(p.failed_count || 0),
        escapeCsv(p.open_defects_count || 0),
        escapeCsv(p.owner_name || ''),
      ].join(','));
    });
    lines.push('');

    lines.push('=== 3. TEST CASES STATUS DISTRIBUTION ===');
    lines.push('Status,Count,Percentage');
    const totalTC = Math.max(1, s.testCasesTotal || 1);
    (adv.byStatus || []).forEach((item) => {
      lines.push(`${escapeCsv(item.status)},${item.count},${Math.round((item.count / totalTC) * 100)}%`);
    });
    lines.push('');

    lines.push('=== 4. DEFECTS BY STATUS ===');
    lines.push('Status,Count');
    (adv.byDefectStatus || []).forEach((item) => {
      lines.push(`${escapeCsv(item.status)},${item.count}`);
    });
    lines.push('');

    lines.push('=== 5. REQUIREMENT TRACEABILITY MATRIX ===');
    lines.push('Requirement ID,Title,Project,Priority,Status,Test Cases Linked,Defects Found,Coverage %');
    (adv.traceability || []).forEach((t) => {
      lines.push([
        escapeCsv(t.requirementId),
        escapeCsv(t.requirementTitle),
        escapeCsv(t.projectName),
        escapeCsv(t.priority),
        escapeCsv(t.status),
        escapeCsv(t.testCasesLinked),
        escapeCsv(t.defectsFound),
        escapeCsv(`${t.coveragePercent}%`),
      ].join(','));
    });
    lines.push('');

    lines.push('=== 6. TEST CYCLES ===');
    lines.push('Cycle ID,Name,Project,Status,Owner,Planned Start,Planned End,Total Cases,Passed,Failed,Progress %');
    (adv.cycles || []).forEach((c) => {
      lines.push([
        escapeCsv(c.id),
        escapeCsv(c.name),
        escapeCsv(c.project_name),
        escapeCsv(c.status),
        escapeCsv(c.owner_name || ''),
        escapeCsv(c.planned_start ? c.planned_start.toString().split('T')[0] : ''),
        escapeCsv(c.planned_end ? c.planned_end.toString().split('T')[0] : ''),
        escapeCsv(c.total_cases || 0),
        escapeCsv(c.passed_cases || 0),
        escapeCsv(c.failed_cases || 0),
        escapeCsv(`${c.progress || 0}%`),
      ].join(','));
    });

    const csvContent = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bank-ina-tcms-report-${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to generate CSV report.' });
  }
});

app.get('/api/reports/html', requireAuth, async (req, res) => {
  try {
    const { projectId = '' } = req.query;
    const adv = await getAdvancedReportData(projectId);
    const s = adv.summary || {};

    const projectName = projectId
      ? ((adv.projects || []).find((p) => String(p.id) === String(projectId))?.name || `Project #${projectId}`)
      : 'All Projects';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bank Ina Digital QA Analytics Report - ${projectName}</title>
  <style>
    :root {
      --ina-navy: #0b1a33;
      --ina-navy-2: #122545;
      --ina-red: #e30613;
      --ina-red-dark: #b91c1c;
      --ina-gold: #c5a86a;
      --ina-green: #059669;
      --ina-amber: #d97706;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --text: #0b1a33;
      --text-muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .report-container {
      max-width: 1200px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(11,26,51,0.08);
      border: 1px solid var(--border);
      overflow: hidden;
    }
    .report-header {
      background: linear-gradient(135deg, #0b1a33 0%, #122545 60%, #1e3a5f 100%);
      color: white;
      padding: 30px;
      position: relative;
      border-bottom: 4px solid var(--ina-red);
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 15px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-badge {
      background: var(--ina-red);
      color: white;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .header-meta {
      font-size: 13px;
      color: #cbd5e1;
      margin-top: 8px;
    }
    .actions-bar {
      display: flex;
      gap: 10px;
    }
    .btn {
      background: var(--ina-red);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-secondary {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.3);
    }
    .btn:hover { opacity: 0.9; }
    .report-body { padding: 30px; }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--ina-navy);
      margin: 28px 0 14px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 8px;
    }
    .section-title:first-child { margin-top: 0; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      transition: transform 0.2s;
    }
    .kpi-value {
      font-size: 26px;
      font-weight: 800;
      color: var(--ina-navy);
      line-height: 1.1;
    }
    .kpi-value.green { color: var(--ina-green); }
    .kpi-value.red { color: var(--ina-red); }
    .kpi-value.gold { color: var(--ina-gold); }
    .kpi-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      margin-top: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 13px;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: #f1f5f9;
      color: var(--ina-navy);
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    tr:hover td { background: #fff1f2; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-pass { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .badge-fail { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .badge-active { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .progress-bar-bg {
      background: #e2e8f0;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      width: 100%;
      max-width: 140px;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #059669, #10b981);
      border-radius: 4px;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 768px) {
      .two-col { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: white; padding: 0; }
      .report-container { box-shadow: none; border: none; }
      .actions-bar { display: none; }
      .btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <header class="report-header">
      <div class="header-top">
        <div>
          <div class="brand-title">
            <span>BANK INA DIGITAL</span>
            <span class="brand-badge">QA Analytics Report</span>
          </div>
          <div class="header-meta">
            Scope: <strong>${projectName}</strong> • Generated on: ${new Date().toLocaleString()} • Exported for Stakeholder Review
          </div>
        </div>
        <div class="actions-bar">
          <button class="btn btn-secondary" onclick="window.print()">🖨️ Print / Save as PDF</button>
          <a class="btn" href="/api/reports/csv${projectId ? '?projectId=' + projectId : ''}" download>📊 Download CSV</a>
        </div>
      </div>
    </header>

    <main class="report-body">
      <h2 class="section-title">1. Executive Summary & Quality Health</h2>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-value">${s.testCasesTotal || 0}</div>
          <div class="kpi-label">Total Test Cases</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value green">${s.testCasesPassed || 0}</div>
          <div class="kpi-label">Passed</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value red">${s.testCasesFailed || 0}</div>
          <div class="kpi-label">Failed</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value green">${s.passRate || 0}%</div>
          <div class="kpi-label">Pass Rate</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value red">${s.defectsTotal || 0}</div>
          <div class="kpi-label">Total Defects</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value red">${s.defectsOpen || 0}</div>
          <div class="kpi-label">Open Defects</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value green">${s.defectsResolved || 0}</div>
          <div class="kpi-label">Resolved</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value gold">${s.defectResolutionRate || 0}%</div>
          <div class="kpi-label">Resolution Rate</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${s.estimatedTotalMinutes ? +((s.estimatedTotalMinutes || 0) / 60).toFixed(1) : 0}h</div>
          <div class="kpi-label">Estimated Effort</div>
        </div>
      </div>

      <h2 class="section-title">2. Projects Progress & Delivery Timelines</h2>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Project Name</th>
            <th>Status</th>
            <th>Timeline</th>
            <th>Progress</th>
            <th>Test Cases</th>
            <th>Open Bugs</th>
            <th>Lead</th>
          </tr>
        </thead>
        <tbody>
          ${(adv.projects || []).map((p) => `
            <tr>
              <td><strong>${p.key_code}</strong></td>
              <td>${p.name}</td>
              <td><span class="badge badge-active">${p.status}</span></td>
              <td>${(p.start_date && p.end_date) ? p.start_date.toString().split('T')[0] + ' ➔ ' + p.end_date.toString().split('T')[0] : 'Ongoing'}</td>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${p.progress || 0}%"></div></div>
                  <strong>${p.progress || 0}%</strong>
                </div>
              </td>
              <td>${p.test_cases_count || 0} (${p.passed_count || 0} passed)</td>
              <td><strong style="color:var(--ina-red)">${p.open_defects_count || 0}</strong></td>
              <td>${p.owner_name || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="two-col" style="margin-top: 24px;">
        <div>
          <h2 class="section-title">3. Test Cases by Status</h2>
          <table>
            <thead><tr><th>Status</th><th>Count</th><th>%</th></tr></thead>
            <tbody>
              ${(adv.byStatus || []).map((b) => `
                <tr>
                  <td>${b.status}</td>
                  <td><strong>${b.count}</strong></td>
                  <td>${Math.round((b.count / Math.max(1, s.testCasesTotal || 1)) * 100)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div>
          <h2 class="section-title">4. Defects by Status</h2>
          <table>
            <thead><tr><th>Status</th><th>Count</th><th>%</th></tr></thead>
            <tbody>
              ${(adv.byDefectStatus || []).map((d) => `
                <tr>
                  <td>${d.status}</td>
                  <td><strong>${d.count}</strong></td>
                  <td>${Math.round((d.count / Math.max(1, s.defectsTotal || 1)) * 100)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <h2 class="section-title">5. Requirement Traceability Matrix</h2>
      <table>
        <thead>
          <tr>
            <th>Requirement Title</th>
            <th>Project</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Test Cases Linked</th>
            <th>Defects Found</th>
            <th>Coverage</th>
          </tr>
        </thead>
        <tbody>
          ${(adv.traceability || []).map((t) => `
            <tr>
              <td><strong>${t.requirementTitle}</strong></td>
              <td>${t.projectName}</td>
              <td>${t.priority}</td>
              <td><span class="badge badge-pass">${t.status}</span></td>
              <td>${t.testCasesLinked}</td>
              <td>${t.defectsFound}</td>
              <td><strong>${t.coveragePercent}%</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2 class="section-title">6. Test Execution Cycles</h2>
      <table>
        <thead>
          <tr>
            <th>Cycle Name</th>
            <th>Project</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Timeline</th>
            <th>Executed</th>
            <th>Passed</th>
            <th>Failed</th>
          </tr>
        </thead>
        <tbody>
          ${(adv.cycles || []).map((c) => `
            <tr>
              <td><strong>${c.name}</strong></td>
              <td>${c.project_name}</td>
              <td><span class="badge badge-active">${c.status}</span></td>
              <td>${c.owner_name || '-'}</td>
              <td>${(c.planned_start && c.planned_end) ? c.planned_start.toString().split('T')[0] + ' ➔ ' + c.planned_end.toString().split('T')[0] : '-'}</td>
              <td>${c.total_cases || 0}</td>
              <td><span style="color:var(--ina-green); font-weight:700;">${c.passed_cases || 0}</span></td>
              <td><span style="color:var(--ina-red); font-weight:700;">${c.failed_cases || 0}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </main>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bank-ina-tcms-report-${Date.now()}.html"`);
    res.send(html);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to generate HTML report.' });
  }
});

app.get('/api/gantt', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.query;
    const cleanProjectId = safeInt(projectId);

    const [projects, milestones, cycles, runs] = await Promise.all([
      pool.query(`
        SELECT p.id, p.name, p.key_code, p.status, p.priority, p.start_date, p.end_date, p.progress, p.budget_hours,
               u.name AS owner_name,
               (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id) AS test_cases_count,
               (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id AND (tc.status = 'Passed' OR tc.status_sit = 'Passed')) AS passed_count,
               (SELECT COUNT(*)::int FROM test_cases tc WHERE tc.project_id = p.id AND (tc.status = 'Failed' OR tc.status_sit = 'Failed')) AS failed_count
        FROM projects p
        LEFT JOIN users u ON u.id = p.owner_id
        ${cleanProjectId ? 'WHERE p.id = $1' : ''}
        ORDER BY p.start_date ASC NULLS LAST, p.id ASC
      `, cleanProjectId ? [cleanProjectId] : []),
      pool.query(`
        SELECT m.id, m.project_id, p.name AS project_name, p.key_code AS project_key,
               m.name, m.description, m.status, m.start_date, m.due_date, m.progress
        FROM milestones m
        JOIN projects p ON p.id = m.project_id
        ${cleanProjectId ? 'WHERE m.project_id = $1' : ''}
        ORDER BY m.start_date ASC NULLS LAST, m.due_date ASC NULLS LAST
      `, cleanProjectId ? [cleanProjectId] : []),
      pool.query(`
        SELECT c.id, c.project_id, p.name AS project_name, p.key_code AS project_key,
               c.name, c.status, c.planned_start, c.planned_end, c.progress, c.estimated_minutes, c.actual_minutes,
               u.name AS owner_name,
               (SELECT COUNT(*)::int FROM cycle_cases cc WHERE cc.cycle_id = c.id) AS total_cases,
               (SELECT COUNT(*)::int FROM cycle_cases cc WHERE cc.cycle_id = c.id AND cc.status = 'Passed') AS passed_cases,
               (SELECT COUNT(*)::int FROM cycle_cases cc WHERE cc.cycle_id = c.id AND cc.status = 'Failed') AS failed_cases
        FROM test_cycles c
        JOIN projects p ON p.id = c.project_id
        LEFT JOIN users u ON u.id = c.owner_id
        ${cleanProjectId ? 'WHERE c.project_id = $1' : ''}
        ORDER BY c.planned_start ASC NULLS LAST, c.id ASC
      `, cleanProjectId ? [cleanProjectId] : []),
      pool.query(`
        SELECT tr.id, tr.project_id, p.name AS project_name, p.key_code AS project_key,
               tr.name, tr.status, tr.planned_start, tr.actual_end, tr.estimated_minutes, tr.actual_minutes,
               u.name AS created_by_name,
               (SELECT COUNT(*)::int FROM test_run_results rr WHERE rr.run_id = tr.id) AS total_cases,
               (SELECT COUNT(*)::int FROM test_run_results rr WHERE rr.run_id = tr.id AND rr.status = 'Passed') AS passed_cases
        FROM test_runs tr
        JOIN projects p ON p.id = tr.project_id
        LEFT JOIN users u ON u.id = tr.created_by
        ${cleanProjectId ? 'WHERE tr.project_id = $1' : ''}
        ORDER BY tr.planned_start ASC NULLS LAST, tr.id ASC
      `, cleanProjectId ? [cleanProjectId] : []),
    ]);

    res.json({
      projectId: cleanProjectId || null,
      projects: projects.rows,
      milestones: milestones.rows,
      cycles: cycles.rows,
      runs: runs.rows,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch Gantt chart data.' });
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

/* ============================================================================
 * CRUD completion layer — Update / Delete for every entity (Phase 1)
 * ==========================================================================*/

const EXECUTION_STATUSES = ['Not Executed', 'In Progress Test', 'Passed', 'Failed', 'Retest', 'Blocked', 'Skipped'];

async function updateRow(tableName, columnMap, body, id) {
  const sets = [];
  const values = [];
  for (const [apiKey, column] of Object.entries(columnMap)) {
    if (body[apiKey] !== undefined) {
      let val = body[apiKey];

      const isNullableNumericOrDate = column.endsWith('_id') ||
        column.endsWith('_date') ||
        column.endsWith('_start') ||
        column.endsWith('_end') ||
        column.endsWith('_at') ||
        column.endsWith('_minutes') ||
        column === 'due_date' ||
        column === 'date_sit_executed' ||
        column === 'date_sit_done' ||
        column === 'planned_start' ||
        column === 'planned_end' ||
        column === 'actual_end' ||
        column === 'start_date' ||
        column === 'end_date' ||
        column === 'estimated_minutes' ||
        column === 'actual_minutes' ||
        column === 'elapsed_minutes' ||
        column === 'progress' ||
        column === 'budget_hours';

      if (val === '' || (typeof val === 'string' && val.trim() === '')) {
        if (isNullableNumericOrDate) {
          val = null;
        }
      } else if (isNullableNumericOrDate && (column.endsWith('_id') || column.endsWith('_minutes') || column === 'progress' || column === 'budget_hours')) {
        const num = parseInt(val, 10);
        val = isNaN(num) ? null : num;
      } else if (isNullableNumericOrDate && (column.endsWith('_date') || column === 'due_date' || column === 'date_sit_executed' || column === 'date_sit_done' || column === 'start_date' || column === 'end_date')) {
        val = safeDate(val);
      }

      values.push(val);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (!sets.length) return { row: null, empty: true };
  values.push(id);
  const result = await pool.query(
    `UPDATE ${tableName} SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
    values
  );
  return { row: result.rows[0] || null, empty: false };
}

const PROJECT_COLUMNS = {
  name: 'name', keyCode: 'key_code', description: 'description', status: 'status', ownerId: 'owner_id',
  startDate: 'start_date', endDate: 'end_date', progress: 'progress', priority: 'priority', budgetHours: 'budget_hours',
};
const REQUIREMENT_COLUMNS = {
  projectId: 'project_id', title: 'title', description: 'description', status: 'status',
  priority: 'priority', source: 'source', userStory: 'user_story', acceptanceCriteria: 'acceptance_criteria',
};
const TEST_CASE_COLUMNS = {
  projectId: 'project_id', code: 'code', title: 'title', summary: 'summary', status: 'status',
  severity: 'severity', priority: 'priority', assigneeId: 'assignee_id', tags: 'tags',
  steps: 'steps', expectedResult: 'expected_result', actualResult: 'actual_result',
  modulFitur: 'modul_fitur', userStoryCoverage: 'user_story_coverage', tipeTest: 'tipe_test',
  userRole: 'user_role', tujuanPengujian: 'tujuan_pengujian', langkahUji: 'langkah_uji',
  validasiDataUji: 'validasi_data_uji', hasilYangDiharapkan: 'hasil_yang_diharapkan',
  picQA: 'pic_qa', statusSIT: 'status_sit', dateSITExecuted: 'date_sit_executed',
  dateSITDone: 'date_sit_done', objectTestVersion: 'object_test_version', apiVersion: 'api_version',
  testScenarioVersion: 'test_scenario_version', requirementId: 'requirement_id',
  suiteId: 'suite_id', milestoneId: 'milestone_id', reviewStatus: 'review_status',
  preconditions: 'preconditions',
};
const TEST_CYCLE_COLUMNS = {
  projectId: 'project_id', name: 'name', status: 'status', ownerId: 'owner_id', summary: 'summary',
  planId: 'plan_id', progress: 'progress', plannedStart: 'planned_start', plannedEnd: 'planned_end',
  estimatedMinutes: 'estimated_minutes', actualMinutes: 'actual_minutes',
};
const TEST_RUN_COLUMNS = {
  projectId: 'project_id', name: 'name', status: 'status', summary: 'summary',
  plannedStart: 'planned_start', actualEnd: 'actual_end',
  estimatedMinutes: 'estimated_minutes', actualMinutes: 'actual_minutes',
};
const DEFECT_COLUMNS = {
  projectId: 'project_id', title: 'title', description: 'description', severity: 'severity',
  priority: 'priority', status: 'status', assigneeId: 'assignee_id', linkedTestCaseId: 'linked_test_case_id',
  linkedCycleId: 'linked_cycle_id', linkedRunId: 'linked_run_id', environment: 'environment',
  stepsToReproduce: 'steps_to_reproduce', resolution: 'resolution',
};

function registerUpdateDelete(path, table, columns, roles, beforeDelete = null) {
  app.put(`/api/${path}/:id`, requireAuth, requireRoles(...roles), async (req, res) => {
    try {
      const { row, empty } = await updateRow(table, columns, req.body || {}, req.params.id);
      if (empty) return res.status(400).json({ message: 'No fields provided to update.' });
      if (!row) return res.status(404).json({ message: `Record not found in ${table}.` });
      await logActivity(req.user.sub, table, row.id, 'update', Object.keys(req.body || {}).join(', '));
      res.json({ record: row });
    } catch (error) {
      res.status(500).json({ message: error.message || `Unable to update ${table}.` });
    }
  });

  app.delete(`/api/${path}/:id`, requireAuth, requireRoles(...roles), async (req, res) => {
    try {
      if (beforeDelete) await beforeDelete(req.params.id);
      const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [req.params.id]);
      if (result.rowCount === 0) return res.status(404).json({ message: `Record not found in ${table}.` });
      res.json({ deleted: true, id: Number(req.params.id) });
    } catch (error) {
      if (error.code === '23503') {
        return res.status(409).json({ message: 'Cannot delete: other records still reference this item.' });
      }
      res.status(500).json({ message: error.message || `Unable to delete from ${table}.` });
    }
  });
}

registerUpdateDelete('projects', 'projects', PROJECT_COLUMNS, ['qa_lead', 'pm'], async (id) => {
  await pool.query('DELETE FROM cycle_cases WHERE cycle_id IN (SELECT id FROM test_cycles WHERE project_id = $1)', [id]);
  await pool.query('DELETE FROM test_run_results WHERE run_id IN (SELECT id FROM test_runs WHERE project_id = $1)', [id]);
  await pool.query('DELETE FROM defects WHERE project_id = $1', [id]);
  await pool.query('DELETE FROM test_case_steps WHERE test_case_id IN (SELECT id FROM test_cases WHERE project_id = $1)', [id]);
  await pool.query('DELETE FROM test_cases WHERE project_id = $1', [id]);
  await pool.query('DELETE FROM test_runs WHERE project_id = $1', [id]);
  await pool.query('DELETE FROM test_cycles WHERE project_id = $1', [id]);
  await pool.query('DELETE FROM test_plans WHERE project_id = $1', [id]);
  await pool.query('DELETE FROM milestones WHERE project_id = $1', [id]);
  await pool.query('DELETE FROM test_suites WHERE project_id = $1', [id]);
  await pool.query('DELETE FROM requirement_documents WHERE project_id = $1', [id]);
  await pool.query('DELETE FROM requirements WHERE project_id = $1', [id]);
});
registerUpdateDelete('requirements', 'requirements', REQUIREMENT_COLUMNS, ['qa_lead', 'pm', 'product', 'business_analyst'], async (id) => {
  await pool.query('UPDATE test_cases SET requirement_id = NULL WHERE requirement_id = $1', [id]);
});
registerUpdateDelete('test-cases', 'test_cases', TEST_CASE_COLUMNS, ['qa_lead', 'qa_engineer', 'pm', 'product'], async (id) => {
  await pool.query('UPDATE defects SET linked_test_case_id = NULL WHERE linked_test_case_id = $1', [id]);
});
registerUpdateDelete('test-cycles', 'test_cycles', TEST_CYCLE_COLUMNS, ['qa_lead', 'pm'], async (id) => {
  await pool.query('UPDATE defects SET linked_cycle_id = NULL WHERE linked_cycle_id = $1', [id]);
});
registerUpdateDelete('test-runs', 'test_runs', TEST_RUN_COLUMNS, ['qa_lead', 'qa_engineer', 'pm'], async (id) => {
  await pool.query('UPDATE defects SET linked_run_id = NULL WHERE linked_run_id = $1', [id]);
});
registerUpdateDelete('defects', 'defects', DEFECT_COLUMNS, ['qa_lead', 'qa_engineer']);

/* ============================================================================
 * Phase 2 — Test suites, milestones, test plans & requirement traceability
 * ==========================================================================*/

const SUITE_COLUMNS = { projectId: 'project_id', parentId: 'parent_id', name: 'name', description: 'description' };
const MILESTONE_COLUMNS = {
  projectId: 'project_id', name: 'name', description: 'description', status: 'status',
  dueDate: 'due_date', startDate: 'start_date', progress: 'progress',
};
const PLAN_COLUMNS = { projectId: 'project_id', milestoneId: 'milestone_id', name: 'name', description: 'description', status: 'status' };

registerUpdateDelete('suites', 'test_suites', SUITE_COLUMNS, ['qa_lead', 'qa_engineer', 'pm', 'product']);
registerUpdateDelete('milestones', 'milestones', MILESTONE_COLUMNS, ['qa_lead', 'pm', 'product']);
registerUpdateDelete('test-plans', 'test_plans', PLAN_COLUMNS, ['qa_lead', 'pm', 'product']);

async function logActivity(actorId, entityType, entityId, action, detail) {
  try {
    await pool.query(
      'INSERT INTO activity_log (actor_id, entity_type, entity_id, action, detail) VALUES ($1,$2,$3,$4,$5)',
      [actorId || null, entityType, entityId || null, action, detail || '']
    );
  } catch (_e) { /* activity logging must never break the request */ }
}

app.get('/api/suites', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.query;
    const params = [];
    let where = '';
    if (projectId) { where = 'WHERE s.project_id = $1'; params.push(projectId); }
    const result = await pool.query(`
      SELECT s.*, p.name AS project_name, ps.name AS parent_name,
             (SELECT COUNT(*) FROM test_cases tc WHERE tc.suite_id = s.id) AS case_count
      FROM test_suites s
      LEFT JOIN projects p ON p.id = s.project_id
      LEFT JOIN test_suites ps ON ps.id = s.parent_id
      ${where}
      ORDER BY s.name ASC
    `, params);
    res.json({ suites: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch test suites.' });
  }
});

app.post('/api/suites', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm', 'product'), async (req, res) => {
  const { projectId, name, parentId, description } = req.body || {};
  if (!projectId || !name) return res.status(400).json({ message: 'Project and suite name are required.' });
  try {
    const result = await pool.query(
      `INSERT INTO test_suites (project_id, name, parent_id, description) VALUES ($1,$2,$3,$4) RETURNING *`,
      [projectId, name, parentId || null, description || '']
    );
    await logActivity(req.user.sub, 'suite', result.rows[0].id, 'create', `Created suite ${name}`);
    res.status(201).json({ suite: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create test suite.' });
  }
});

app.get('/api/milestones', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.query;
    const params = [];
    let where = '';
    if (projectId) { where = 'WHERE m.project_id = $1'; params.push(projectId); }
    const result = await pool.query(`
      SELECT m.*, p.name AS project_name,
             (SELECT COUNT(*) FROM test_cases tc WHERE tc.milestone_id = m.id) AS case_count
      FROM milestones m
      LEFT JOIN projects p ON p.id = m.project_id
      ${where}
      ORDER BY m.due_date ASC NULLS LAST, m.name ASC
    `, params);
    res.json({ milestones: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch milestones.' });
  }
});

app.post('/api/milestones', requireAuth, requireRoles('qa_lead', 'pm', 'product'), async (req, res) => {
  const { projectId, name, description, status = 'Open', dueDate, startDate, progress = 0 } = req.body || {};
  if (!projectId || !name) return res.status(400).json({ message: 'Project and milestone name are required.' });
  try {
    const result = await pool.query(
      `INSERT INTO milestones (project_id, name, description, status, due_date, start_date, progress) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [safeInt(projectId), name.trim(), description || '', status, safeDate(dueDate), safeDate(startDate), Math.max(0, Math.min(100, safeInt(progress) || 0))]
    );
    await logActivity(req.user.sub, 'milestone', result.rows[0].id, 'create', `Created milestone ${name}`);
    res.status(201).json({ milestone: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create milestone.' });
  }
});

app.get('/api/test-plans', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.query;
    const params = [];
    let where = '';
    if (projectId) { where = 'WHERE tp.project_id = $1'; params.push(projectId); }
    const result = await pool.query(`
      SELECT tp.*, p.name AS project_name, m.name AS milestone_name,
             (SELECT COUNT(*) FROM test_cycles c WHERE c.plan_id = tp.id) AS cycle_count
      FROM test_plans tp
      LEFT JOIN projects p ON p.id = tp.project_id
      LEFT JOIN milestones m ON m.id = tp.milestone_id
      ${where}
      ORDER BY tp.updated_at DESC
    `, params);
    res.json({ plans: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch test plans.' });
  }
});

app.post('/api/test-plans', requireAuth, requireRoles('qa_lead', 'pm', 'product'), async (req, res) => {
  const { projectId, name, description, status = 'Draft', milestoneId } = req.body || {};
  if (!projectId || !name) return res.status(400).json({ message: 'Project and plan name are required.' });
  try {
    const result = await pool.query(
      `INSERT INTO test_plans (project_id, name, description, status, milestone_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [projectId, name, description || '', status, milestoneId || null]
    );
    await logActivity(req.user.sub, 'test_plan', result.rows[0].id, 'create', `Created test plan ${name}`);
    res.status(201).json({ plan: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create test plan.' });
  }
});

app.get('/api/traceability', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.query;
    const reqParams = [];
    const caseParams = [];
    const reqWhere = projectId ? 'WHERE r.project_id = $1' : '';
    const caseWhere = projectId ? 'WHERE tc.project_id = $1' : '';
    if (projectId) { reqParams.push(projectId); caseParams.push(projectId); }

    const requirements = await pool.query(`
      SELECT r.id, r.title, r.status, r.priority, r.project_id, p.name AS project_name,
        (SELECT COUNT(*) FROM test_cases tc WHERE tc.requirement_id = r.id) AS case_count,
        (SELECT COUNT(*) FROM test_cases tc WHERE tc.requirement_id = r.id AND tc.review_status = 'Approved') AS approved_count,
        (SELECT COUNT(*) FROM test_cases tc WHERE tc.requirement_id = r.id AND tc.status = 'Passed') AS passed_count
      FROM requirements r
      LEFT JOIN projects p ON p.id = r.project_id
      ${reqWhere}
      ORDER BY r.updated_at DESC
    `, reqParams);

    const testCases = await pool.query(`
      SELECT tc.id, tc.code, tc.title, tc.requirement_id, tc.status, tc.review_status, tc.severity,
             tc.tipe_test, tc.modul_fitur, tc.suite_id, p.name AS project_name
      FROM test_cases tc
      LEFT JOIN projects p ON p.id = tc.project_id
      ${caseWhere}
      ORDER BY tc.code ASC
    `, caseParams);

    const linked = {};
    testCases.rows.forEach((tc) => {
      if (!tc.requirement_id) return;
      linked[tc.requirement_id] = linked[tc.requirement_id] || [];
      linked[tc.requirement_id].push(tc);
    });

    const rows = requirements.rows.map((r) => {
      const cases = linked[r.id] || [];
      const coverage = cases.length ? Math.round((Number(r.passed_count) / cases.length) * 100) : 0;
      return { ...r, coverage_percent: coverage, testCases: cases };
    });

    const uncovered = testCases.rows.filter((tc) => !tc.requirement_id);

    res.json({
      traceability: rows,
      uncoveredCases: uncovered,
      summary: {
        totalRequirements: requirements.rowCount,
        coveredRequirements: rows.filter((r) => Number(r.case_count) > 0).length,
        totalCases: testCases.rowCount,
        uncoveredCases: uncovered.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to build traceability matrix.' });
  }
});

/* ============================================================================
 * Phase 3 — Structured steps, shared steps, versioning, clone, bulk edit,
 *           review workflow, attachments & tags
 * ==========================================================================*/

const REVIEW_STATUSES = ['Draft', 'In Review', 'Approved', 'Rejected', 'Deprecated'];

app.get('/api/shared-steps', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.query;
    const result = await pool.query(
      `SELECT * FROM shared_steps ${projectId ? 'WHERE project_id = $1' : ''} ORDER BY title ASC`,
      projectId ? [projectId] : []
    );
    res.json({ sharedSteps: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch shared steps.' });
  }
});

app.post('/api/shared-steps', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm'), async (req, res) => {
  const { projectId, title, action, expectedResult } = req.body || {};
  if (!projectId || !title) return res.status(400).json({ message: 'Project and title are required.' });
  try {
    const result = await pool.query(
      `INSERT INTO shared_steps (project_id, title, action, expected_result) VALUES ($1,$2,$3,$4) RETURNING *`,
      [projectId, title, action || '', expectedResult || '']
    );
    res.status(201).json({ sharedStep: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create shared step.' });
  }
});

app.get('/api/test-cases/:id/steps', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM test_case_steps WHERE test_case_id = $1 ORDER BY step_no ASC',
      [req.params.id]
    );
    res.json({ steps: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch test case steps.' });
  }
});

app.put('/api/test-cases/:id/steps', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm', 'product'), async (req, res) => {
  const { steps = [] } = req.body || {};
  if (!Array.isArray(steps)) return res.status(400).json({ message: 'Steps must be an array.' });
  try {
    await pool.query('DELETE FROM test_case_steps WHERE test_case_id = $1', [req.params.id]);
    const created = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i] || {};
      const row = await pool.query(
        `INSERT INTO test_case_steps (test_case_id, step_no, action, expected_result, test_data)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.params.id, i + 1, step.action || '', step.expectedResult || '', step.testData || '']
      );
      created.push(row.rows[0]);
    }
    // Keep the denormalised text column in sync for the 18-column export.
    const text = created.map((s) => `${s.step_no}. ${s.action}`).join('\n');
    await pool.query('UPDATE test_cases SET langkah_uji = $1, steps = $1, updated_at = NOW() WHERE id = $2', [text, req.params.id]);
    await logActivity(req.user.sub, 'test_case', req.params.id, 'update_steps', `${created.length} step(s)`);
    res.json({ steps: created });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to save test case steps.' });
  }
});

app.get('/api/test-cases/:id/versions', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, u.name AS changed_by_name
      FROM test_case_versions v
      LEFT JOIN users u ON u.id = v.changed_by
      WHERE v.test_case_id = $1
      ORDER BY v.version_no DESC
    `, [req.params.id]);
    res.json({ versions: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch version history.' });
  }
});

app.post('/api/test-cases/:id/review', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm', 'product'), async (req, res) => {
  const { reviewStatus, changeSummary } = req.body || {};
  if (!reviewStatus || !REVIEW_STATUSES.includes(reviewStatus)) {
    return res.status(400).json({ message: 'A valid review status is required.' });
  }
  if (['Approved', 'Rejected'].includes(reviewStatus) && !['qa_lead', 'pm', 'product'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only QA Lead, PM, or Product can approve or reject test cases.' });
  }
  try {
    const current = await pool.query('SELECT * FROM test_cases WHERE id = $1', [req.params.id]);
    if (current.rowCount === 0) return res.status(404).json({ message: 'Test case not found.' });
    const nextVersion = (current.rows[0].version_no || 1) + (reviewStatus === 'Approved' ? 1 : 0);

    const result = await pool.query(
      `UPDATE test_cases
       SET review_status = $1::text,
           approved_by = CASE WHEN $1::text = 'Approved' THEN $2 ELSE approved_by END,
           version_no = $3,
           updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [reviewStatus, req.user.sub, nextVersion, req.params.id]
    );

    await pool.query(
      `INSERT INTO test_case_versions (test_case_id, version_no, snapshot, change_summary, changed_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, nextVersion, JSON.stringify(result.rows[0]), changeSummary || `Review status set to ${reviewStatus}`, req.user.sub]
    );
    await logActivity(req.user.sub, 'test_case', req.params.id, 'review', reviewStatus);
    res.json({ testCase: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to update review status.' });
  }
});

app.post('/api/test-cases/:id/clone', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm', 'product'), async (req, res) => {
  try {
    const source = await pool.query('SELECT * FROM test_cases WHERE id = $1', [req.params.id]);
    if (source.rowCount === 0) return res.status(404).json({ message: 'Test case not found.' });
    const tc = source.rows[0];
    const suffix = Date.now().toString().slice(-4);
    const newCode = `${tc.code}-C${suffix}`;

    const result = await pool.query(
      `INSERT INTO test_cases (
        project_id, code, title, summary, status, severity, priority, assignee_id, creator_id,
        steps, expected_result, tags, modul_fitur, user_story_coverage, tipe_test, user_role,
        tujuan_pengujian, langkah_uji, validasi_data_uji, hasil_yang_diharapkan, pic_qa, status_sit,
        object_test_version, api_version, test_scenario_version, requirement_id, suite_id, milestone_id,
        review_status, preconditions
      )
      SELECT project_id, $2, title, summary, 'Draft', severity, priority, assignee_id, $3,
        steps, expected_result, tags, modul_fitur, user_story_coverage, tipe_test, user_role,
        tujuan_pengujian, langkah_uji, validasi_data_uji, hasil_yang_diharapkan, pic_qa, status_sit,
        object_test_version, api_version, test_scenario_version, requirement_id, suite_id, milestone_id,
        'Draft', preconditions
      FROM test_cases WHERE id = $1
      RETURNING *`,
      [req.params.id, newCode, req.user.sub]
    );

    const cloneId = result.rows[0].id;
    const steps = await pool.query('SELECT step_no, action, expected_result, test_data FROM test_case_steps WHERE test_case_id = $1', [req.params.id]);
    for (const s of steps.rows) {
      await pool.query(
        `INSERT INTO test_case_steps (test_case_id, step_no, action, expected_result, test_data) VALUES ($1,$2,$3,$4,$5)`,
        [cloneId, s.step_no, s.action, s.expected_result, s.test_data]
      );
    }
    await logActivity(req.user.sub, 'test_case', cloneId, 'clone', `Cloned from ${tc.code}`);
    res.status(201).json({ testCase: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to clone test case.' });
  }
});

app.patch('/api/test-cases/bulk', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm', 'product'), async (req, res) => {
  const { ids = [], patch = {} } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'Select at least one test case.' });
  const allowed = ['status', 'severity', 'priority', 'assigneeId', 'tipeTest', 'statusSIT', 'suiteId', 'milestoneId', 'reviewStatus', 'picQA', 'objectTestVersion', 'apiVersion', 'testScenarioVersion'];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (patch[key] === undefined) continue;
    const column = TEST_CASE_COLUMNS[key];
    if (!column) continue;
    values.push(patch[key]);
    sets.push(`${column} = $${values.length}`);
  }
  if (!sets.length) return res.status(400).json({ message: 'No supported fields provided for bulk edit.' });
  values.push(ids);
  try {
    const result = await pool.query(
      `UPDATE test_cases SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ANY($${values.length}::int[]) RETURNING *`,
      values
    );
    await logActivity(req.user.sub, 'test_case', null, 'bulk_update', `${result.rowCount} case(s)`);
    res.json({ updated: result.rowCount, testCases: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to bulk edit test cases.' });
  }
});

app.get('/api/tags', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT tags FROM test_cases WHERE tags IS NOT NULL AND tags <> ''`);
    const tagSet = new Set();
    result.rows.forEach((row) => {
      String(row.tags).split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => tagSet.add(t));
    });
    res.json({ tags: Array.from(tagSet).sort() });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch tags.' });
  }
});

app.get('/api/attachments', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) return res.status(400).json({ message: 'entityType and entityId are required.' });
    const result = await pool.query(`
      SELECT a.*, u.name AS uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON u.id = a.uploaded_by
      WHERE a.entity_type = $1 AND a.entity_id = $2
      ORDER BY a.created_at DESC
    `, [entityType, entityId]);
    res.json({ attachments: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch attachments.' });
  }
});

app.post('/api/attachments', requireAuth, uploadAny.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'A file is required.' });
    const { entityType, entityId } = req.body || {};
    if (!entityType || !entityId) return res.status(400).json({ message: 'entityType and entityId are required.' });
    const result = await pool.query(
      `INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [entityType, entityId, req.file.originalname, req.file.path, req.file.size, req.file.mimetype, req.user.sub]
    );
    await logActivity(req.user.sub, entityType, entityId, 'attach', req.file.originalname);
    res.status(201).json({ attachment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to upload attachment.' });
  }
});

app.get('/api/attachments/:id/download', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM attachments WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Attachment not found.' });
    const file = result.rows[0];
    if (!file.file_path || !fs.existsSync(file.file_path)) {
      return res.status(404).json({ message: 'Attachment file is not available on disk.' });
    }
    return res.download(file.file_path, file.file_name);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to download attachment.' });
  }
});

app.delete('/api/attachments/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM attachments WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Attachment not found.' });
    const file = result.rows[0];
    if (file.file_path && fs.existsSync(file.file_path)) {
      try { fs.unlinkSync(file.file_path); } catch (_e) {}
    }
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to delete attachment.' });
  }
});

/* ============================================================================
 * Phase 4 — Execution results, defect linkage, coverage & trend reporting,
 *           activity feed
 * ==========================================================================*/

app.get('/api/test-runs/:id/results', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT trr.*, tc.code, tc.title, tc.severity, tc.priority, u.name AS assignee_name
      FROM test_run_results trr
      LEFT JOIN test_cases tc ON tc.id = trr.test_case_id
      LEFT JOIN users u ON u.id = trr.assignee_id
      WHERE trr.run_id = $1
      ORDER BY trr.id ASC
    `, [req.params.id]);
    res.json({ results: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch run results.' });
  }
});

app.patch('/api/test-runs/:runId/results/:resultId', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm'), async (req, res) => {
  const { status, notes, elapsedMinutes, environment, evidenceUrl, assigneeId } = req.body || {};
  const allowedStatuses = ['Not Run', 'Passed', 'Failed', 'Blocked', 'Retest', 'Skipped'];
  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid run result status.' });
  }
  try {
    const result = await pool.query(
      `UPDATE test_run_results
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           elapsed_minutes = COALESCE($3, elapsed_minutes),
           environment = COALESCE($4, environment),
           evidence_url = COALESCE($5, evidence_url),
           assignee_id = COALESCE($6, assignee_id),
           executed_at = CASE WHEN $1 IS NOT NULL THEN NOW() ELSE executed_at END
       WHERE id = $7 AND run_id = $8
       RETURNING *`,
      [status || null, notes ?? null, elapsedMinutes ?? null, environment ?? null, evidenceUrl ?? null, assigneeId || null, req.params.resultId, req.params.runId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Run result not found.' });
    await logActivity(req.user.sub, 'test_run_result', req.params.resultId, 'execute', status || 'updated');
    res.json({ result: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to update run result.' });
  }
});

app.post('/api/executions/:id/create-defect', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm'), async (req, res) => {
  try {
    const exec = await pool.query(`
      SELECT cc.*, tc.title AS case_title, tc.code AS case_code, cyc.project_id, cyc.id AS cycle_id
      FROM cycle_cases cc
      LEFT JOIN test_cases tc ON tc.id = cc.test_case_id
      LEFT JOIN test_cycles cyc ON cyc.id = cc.cycle_id
      WHERE cc.id = $1
    `, [req.params.id]);
    if (exec.rowCount === 0) return res.status(404).json({ message: 'Execution record not found.' });
    const row = exec.rows[0];
    const { title, description, severity = 'Major', priority = 'Medium', environment = 'SIT', stepsToReproduce } = req.body || {};

    const defect = await pool.query(
      `INSERT INTO defects (project_id, title, description, severity, priority, status, assignee_id, reporter_id, linked_test_case_id, linked_cycle_id, environment, steps_to_reproduce)
       VALUES ($1,$2,$3,$4,$5,'Open',$6,$7,$8,$9,$10,$11) RETURNING *`,
      [row.project_id, title || `Defect from failed execution ${row.case_code || row.id}`, description || '', severity, priority,
        null, req.user.sub, row.test_case_id, row.cycle_id, environment, stepsToReproduce || '']
    );
    await logActivity(req.user.sub, 'defect', defect.rows[0].id, 'create_from_execution', row.case_code || String(row.id));
    res.status(201).json({ defect: defect.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to create defect from execution.' });
  }
});

app.get('/api/reports/coverage', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.query;
    const params = projectId ? [projectId] : [];
    const where = projectId ? 'WHERE tc.project_id = $1' : '';

    const bySuite = await pool.query(`
      SELECT COALESCE(s.name, 'Unassigned') AS suite_name, s.id AS suite_id,
             COUNT(tc.id)::int AS total,
             COUNT(*) FILTER (WHERE tc.review_status = 'Approved')::int AS approved,
             COUNT(*) FILTER (WHERE tc.status = 'Passed')::int AS passed,
             COUNT(*) FILTER (WHERE tc.status = 'Failed')::int AS failed
      FROM test_cases tc
      LEFT JOIN test_suites s ON s.id = tc.suite_id
      ${where}
      GROUP BY s.id, s.name
      ORDER BY total DESC
    `, params);

    const byMilestone = await pool.query(`
      SELECT COALESCE(m.name, 'No milestone') AS milestone_name, m.due_date,
             COUNT(tc.id)::int AS total,
             COUNT(*) FILTER (WHERE tc.status = 'Passed')::int AS passed,
             COUNT(*) FILTER (WHERE tc.status = 'Failed')::int AS failed
      FROM test_cases tc
      LEFT JOIN milestones m ON m.id = tc.milestone_id
      ${where}
      GROUP BY m.id, m.name, m.due_date
      ORDER BY total DESC
    `, params);

    const byModule = await pool.query(`
      SELECT COALESCE(tc.modul_fitur, 'Unassigned') AS modul_fitur,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE tc.status = 'Passed')::int AS passed,
             COUNT(*) FILTER (WHERE tc.status = 'Failed')::int AS failed
      FROM test_cases tc
      ${where}
      GROUP BY tc.modul_fitur
      ORDER BY total DESC
    `, params);

    res.json({ bySuite: bySuite.rows, byMilestone: byMilestone.rows, byModule: byModule.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to build coverage report.' });
  }
});

app.get('/api/reports/trend', requireAuth, async (req, res) => {
  try {
    const runs = await pool.query(`
      SELECT DATE(tr.created_at) AS day,
             COUNT(DISTINCT tr.id)::int AS runs,
             COUNT(trr.id) FILTER (WHERE trr.status = 'Passed')::int AS passed,
             COUNT(trr.id) FILTER (WHERE trr.status = 'Failed')::int AS failed,
             COUNT(trr.id) FILTER (WHERE trr.status IN ('Blocked','Retest'))::int AS blocked
      FROM test_runs tr
      LEFT JOIN test_run_results trr ON trr.run_id = tr.id
      GROUP BY DATE(tr.created_at)
      ORDER BY day ASC
      LIMIT 30
    `);

    const executions = await pool.query(`
      SELECT DATE(cc.executed_at) AS day,
             COUNT(*) FILTER (WHERE cc.status = 'Passed')::int AS passed,
             COUNT(*) FILTER (WHERE cc.status = 'Failed')::int AS failed
      FROM cycle_cases cc
      WHERE cc.executed_at IS NOT NULL
      GROUP BY DATE(cc.executed_at)
      ORDER BY day ASC
      LIMIT 30
    `);

    res.json({ runsTrend: runs.rows, executionTrend: executions.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to build trend report.' });
  }
});

app.get('/api/activity', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 40, 200);
    const result = await pool.query(`
      SELECT a.*, u.name AS actor_name, u.avatar AS actor_avatar
      FROM activity_log a
      LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC
      LIMIT $1
    `, [limit]);
    res.json({ activity: result.rows });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to fetch activity log.' });
  }
});

app.patch('/api/executions/:id', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm'), async (req, res) => {
  const { status, notes, assigneeId } = req.body || {};
  if (status && !EXECUTION_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid execution status.' });
  }
  try {
    const result = await pool.query(
      `UPDATE cycle_cases
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           assignee_id = COALESCE($3, assignee_id),
           executed_at = CASE WHEN $1 IS NOT NULL THEN NOW() ELSE executed_at END
       WHERE id = $4
       RETURNING *`,
      [status || null, notes ?? null, assigneeId || null, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Execution record not found.' });
    res.json({ execution: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to update execution.' });
  }
});

app.post('/api/test-cycles/:id/cases', requireAuth, requireRoles('qa_lead', 'qa_engineer', 'pm'), async (req, res) => {
  const { testCaseIds = [] } = req.body || {};
  if (!Array.isArray(testCaseIds) || testCaseIds.length === 0) {
    return res.status(400).json({ message: 'At least one test case is required.' });
  }
  try {
    const inserted = [];
    for (const testCaseId of testCaseIds) {
      const existing = await pool.query(
        'SELECT id FROM cycle_cases WHERE cycle_id = $1 AND test_case_id = $2',
        [req.params.id, testCaseId]
      );
      if (existing.rowCount > 0) continue;
      const row = await pool.query(
        `INSERT INTO cycle_cases (cycle_id, test_case_id, status, assignee_id)
         VALUES ($1, $2, 'Not Executed', $3) RETURNING *`,
        [req.params.id, testCaseId, req.user.sub]
      );
      inserted.push(row.rows[0]);
    }
    res.status(201).json({ added: inserted.length, executions: inserted });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Unable to add test cases to cycle.' });
  }
});

async function startServer() {
  await initializeDatabase();

  app.listen(config.port, () => {
    console.log(`BINA QA TCMS API listening on port ${config.port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
