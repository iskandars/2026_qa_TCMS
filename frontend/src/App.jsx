import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const roleMeta = {
  qa_lead: { label: 'QA Lead', color: '#7f1d1d' },
  qa_engineer: { label: 'QA Engineer', color: '#b91c1c' },
  product: { label: 'Product', color: '#991b1b' },
  pm: { label: 'PM', color: '#dc2626' },
  business_analyst: { label: 'Business Analyst', color: '#1e3a8a' },
};

const initialCredentials = {
  qa_lead: { email: 'qa.lead@company.com', password: 'Password123!' },
  qa_engineer: { email: 'qa.engineer@company.com', password: 'Password123!' },
  product: { email: 'product@company.com', password: 'Password123!' },
  pm: { email: 'pm@company.com', password: 'Password123!' },
  business_analyst: { email: 'business.analyst@company.com', password: 'Password123!' },
};

const workflowStatus = ['Open', 'In Progress', 'In Review', 'Rejected', 'Resolved', 'Closed'];
const navItems = ['overview', 'requirements', 'test-cases', 'test-cycles', 'test-runs', 'execution-board', 'defects', 'reports', 'admin'];
const testCaseStatuses = ['Draft', 'Review', 'Ready', 'Deprecated', 'Passed', 'Failed'];
const testCaseSeverities = ['Trivial', 'Minor', 'Major', 'Critical'];
const testCasePriorities = ['Low', 'Medium', 'High', 'Urgent'];
const tipeTestDefaults = ['Functional', 'Regression', 'Integration', 'API', 'UI', 'Performance', 'Security', 'UAT', 'SIT', 'Smoke', 'Sanity'];
const userRoleDefaults = ['Admin', 'User', 'Guest', 'Manager', 'Operator', 'Customer', 'Teller', 'Back Office'];
const sitStatusDefaults = ['Not Started', 'In Progress', 'Blocked', 'Passed', 'Failed', 'Skipped'];

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatMinutes(mins) {
  const m = Number(mins || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function flattenData(records) {
  return records.map((item) => {
    const copy = { ...item };
    Object.keys(copy).forEach((key) => {
      if (copy[key] === null || copy[key] === undefined) copy[key] = '';
    });
    return copy;
  });
}

function hasPerm(permissions, perm) {
  return Array.isArray(permissions) && permissions.includes(perm);
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(() => localStorage.getItem('tcmsTheme') || 'light');
  const [token, setToken] = useState(localStorage.getItem('tcmsToken') || '');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tcmsUser') || 'null'); }
    catch { return null; }
  });
  const [permissions, setPermissions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tcmsPerms') || '[]'); }
    catch { return []; }
  });
  const [selectedRole, setSelectedRole] = useState('qa_lead');
  const [loginForm, setLoginForm] = useState(initialCredentials.qa_lead);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tcmsTheme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const path = location.pathname.replace(/^\//, '');
    if (!token || !user) {
      if (location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    } else {
      if (location.pathname === '/' || location.pathname === '/login') {
        navigate('/overview', { replace: true });
      } else if (navItems.includes(path) && path !== activeTab) {
        setActiveTab(path);
      }
    }
  }, [location.pathname, token, user, navigate]);

  const handleTabClick = (item) => {
    setActiveTab(item);
    navigate(`/${item}`);
  };


  const [data, setData] = useState({
    projects: [], users: [], testCases: [], requirements: [], cycles: [], testRuns: [],
    executions: [], defects: [], workflow: workflowStatus,
    admin: { rolePermissions: {}, roles: [], users: [] },
    overview: null, advanced: null, estimate: null,
    docUploads: [], generatedScenarios: [], userStoriesFromPDF: [],
    tipeTestOptions: tipeTestDefaults, userRoleOptions: userRoleDefaults,
    searchTerm: '',
  });

  const [reportTab, setReportTab] = useState('summary');

  const [newRequirement, setNewRequirement] = useState({ projectId: '', title: '', description: '', priority: 'High', source: 'Business', userStory: '', acceptanceCriteria: '' });
  const [newCycle, setNewCycle] = useState({ projectId: '', name: '', status: 'Planned', summary: '' });
  const [newTestCase, setNewTestCase] = useState({
    projectId: '', code: '', title: '', summary: '', status: 'Draft', severity: 'Major', priority: 'Medium',
    assigneeId: '', tags: '', steps: '', expectedResult: '',
    modulFitur: '', userStoryCoverage: '', tipeTest: 'Functional', userRole: '',
    tujuanPengujian: '', langkahUji: '', validasiDataUji: '', hasilYangDiharapkan: '',
    picQA: '', statusSIT: 'Not Started', dateSITExecuted: '', dateSITDone: '',
    objectTestVersion: 'v1.0.0', apiVersion: 'v1.0', testScenarioVersion: 'v1.0',
  });
  const [showTestCaseForm, setShowTestCaseForm] = useState(false);
  const [newTestRun, setNewTestRun] = useState({ projectId: '', name: '', status: 'Planned', cycleId: '', testCaseIds: [] });
  const [showTestRunForm, setShowTestRunForm] = useState(false);
  const [filters, setFilters] = useState({
    projectId: '', status: '', severity: '', priority: '', assignee: '', tags: '',
    modulFitur: '', tipeTest: '', statusSIT: '', search: '', userStoryCoverage: '',
    defectPriority: '', defectEnvironment: '', reporter: '',
  });
  const [scenarioGen, setScenarioGen] = useState({ projectId: '', requirementId: '', documentId: '', prefix: '', fullCoverage: false });
  const [pdfUpload, setPdfUpload] = useState({ projectId: '', requirementId: '', uploading: false });
  const [selectedScenarios, setSelectedScenarios] = useState([]);
  const [estimateScope, setEstimateScope] = useState({ projectId: '', runId: '', cycleId: '' });

  const userRole = user?.role || selectedRole;

  const summaryCards = useMemo(() => {
    const overview = data.overview || { summary: {} };
    const s = overview.summary || {};
    return [
      { label: 'Projects', value: formatNumber(s.projects ?? 0), tone: 'red' },
      { label: 'Test Cases', value: formatNumber(s.testCases ?? 0), tone: 'blue' },
      { label: 'Open Defects', value: formatNumber(s.openDefects ?? 0), tone: 'amber' },
      { label: 'Execution Runs', value: formatNumber(s.testRuns ?? 0), tone: 'green' },
    ];
  }, [data.overview]);

  const canWriteTC = hasPerm(permissions, 'write') || ['qa_lead', 'qa_engineer', 'pm', 'product'].includes(userRole);
  const canBulkImport = hasPerm(permissions, 'bulk_import') || ['qa_lead', 'qa_engineer', 'pm', 'product'].includes(userRole);
  const canGenerateScenarios = hasPerm(permissions, 'generate_scenarios') || ['qa_lead', 'qa_engineer', 'pm', 'product', 'business_analyst'].includes(userRole);
  const canUploadRequirements = hasPerm(permissions, 'upload_requirements') || ['qa_lead', 'qa_engineer', 'pm', 'product', 'business_analyst'].includes(userRole);
  const canExportReports = hasPerm(permissions, 'export_reports') || true;
  const canManageCycles = hasPerm(permissions, 'manage_cycles') || ['qa_lead', 'pm'].includes(userRole);
  const canCreateDefects = ['qa_lead', 'qa_engineer'].includes(userRole);
  const isAdmin = userRole === 'qa_lead';

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      setInfo('');
      const headers = getAuthHeaders(token);
      const build = (path) => axios.get(`${API_URL}${path}`, { headers });

      const [overviewRes, projectRes, userRes, requirementRes, cycleRes, executionRes, defectRes, adminRes, testCaseRes, testRunRes, advancedRes, estimateRes, docRes] = await Promise.all([
        build('/dashboard/overview'),
        build('/projects'),
        build('/users'),
        build('/requirements'),
        build('/test-cycles'),
        build('/executions'),
        build('/defects'),
        build('/admin/permissions').catch(() => ({ data: { rolePermissions: {}, roles: [], users: [] } })),
        build('/test-cases'),
        build('/test-runs'),
        build('/reports/advanced'),
        build('/reports/estimate'),
        build('/requirement-documents'),
      ]);

      const ov = overviewRes.data;
      setData((d) => ({
        ...d,
        overview: ov,
        projects: projectRes.data.projects || [],
        users: userRes.data.users || [],
        testCases: testCaseRes.data.testCases || ov.latestCases || [],
        requirements: requirementRes.data.requirements || [],
        cycles: cycleRes.data.cycles || [],
        testRuns: testRunRes.data.testRuns || [],
        executions: executionRes.data.executions || [],
        defects: defectRes.data.defects || [],
        workflow: defectRes.data.workflow || workflowStatus,
        admin: adminRes.data || { rolePermissions: {}, roles: [], users: [] },
        advanced: advancedRes.data || null,
        estimate: estimateRes.data || null,
        docUploads: docRes.data.documents || [],
        tipeTestOptions: testCaseRes.data.tipeTestOptions || ov.advancedConfig?.tipeTestOptions || tipeTestDefaults,
        userRoleOptions: testCaseRes.data.userRoleOptions || ov.advancedConfig?.userRoleOptions || userRoleDefaults,
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load QA workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setData({
        projects: [], users: [], testCases: [], requirements: [], cycles: [], testRuns: [],
        executions: [], defects: [], workflow: workflowStatus,
        admin: { rolePermissions: {}, roles: [], users: [] },
        overview: null, advanced: null, estimate: null,
        docUploads: [], generatedScenarios: [], userStoriesFromPDF: [],
        tipeTestOptions: tipeTestDefaults, userRoleOptions: userRoleDefaults, searchTerm: '',
      });
      return;
    }
    loadDashboard();
  }, [token]);

  const statusSummary = useMemo(() => {
    const summaryMap = Object.fromEntries((data.overview?.byStatus || []).map((item) => [item.status, item.count]));
    return [
      { label: 'Passed', count: summaryMap.Passed || 0, color: '#16a34a' },
      { label: 'Failed', count: summaryMap.Failed || 0, color: '#dc2626' },
      { label: 'Retest', count: summaryMap.Retest || 0, color: '#f59e0b' },
      { label: 'TBC', count: summaryMap.TBC || 0, color: '#0ea5e9' },
    ];
  }, [data.overview]);

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setLoginForm(initialCredentials[role]);
  };

  const persistSession = (receivedToken, receivedUser, perms) => {
    localStorage.setItem('tcmsToken', receivedToken);
    localStorage.setItem('tcmsUser', JSON.stringify(receivedUser));
    localStorage.setItem('tcmsPerms', JSON.stringify(perms || []));
    setToken(receivedToken);
    setUser(receivedUser);
    setPermissions(perms || []);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await axios.post(`${API_URL}/auth/login`, loginForm);
      persistSession(response.data.token, response.data.user, response.data.permissions);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    }
  };

  const handleSSO = async () => {
    setError('');
    try {
      const email = loginForm.email || `${selectedRole}@company.com`;
      const response = await axios.post(`${API_URL}/auth/sso/login`, {
        email, name: roleMeta[selectedRole]?.label || 'SSO User', role: selectedRole,
      });
      persistSession(response.data.token, response.data.user, response.data.permissions);
    } catch (err) {
      setError(err.response?.data?.message || 'SSO login failed.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tcmsToken');
    localStorage.removeItem('tcmsUser');
    localStorage.removeItem('tcmsPerms');
    setToken(''); setUser(null); setPermissions([]); setError(''); setInfo('');
  };

  const createRequirement = async () => {
    if (!newRequirement.projectId || !newRequirement.title) { setError('Project and requirement title are required.'); return; }
    try {
      await axios.post(`${API_URL}/requirements`, newRequirement, { headers: getAuthHeaders(token) });
      setNewRequirement({ projectId: '', title: '', description: '', priority: 'High', source: 'Business', userStory: '', acceptanceCriteria: '' });
      setError(''); setInfo('Requirement created.');
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not create requirement.'); }
  };

  const createCycle = async () => {
    if (!canManageCycles) { setError('Permission denied: only QA Lead / PM can create cycles.'); return; }
    if (!newCycle.projectId || !newCycle.name) { setError('Project and cycle name are required.'); return; }
    try {
      const r = await axios.post(`${API_URL}/test-cycles`, newCycle, { headers: getAuthHeaders(token) });
      setNewCycle({ projectId: '', name: '', status: 'Planned', summary: '' });
      setInfo(`Cycle created with estimate: ${formatMinutes(r.data.estimatedMinutes)}`);
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not create execution cycle.'); }
  };

  const createTestCase = async () => {
    if (!canWriteTC) { setError('Permission denied.'); return; }
    if (!newTestCase.projectId || !newTestCase.code || !newTestCase.title) {
      setError('Project, code, and title are required.'); return;
    }
    try {
      await axios.post(`${API_URL}/test-cases`, newTestCase, { headers: getAuthHeaders(token) });
      setNewTestCase({
        projectId: '', code: '', title: '', summary: '', status: 'Draft', severity: 'Major', priority: 'Medium',
        assigneeId: '', tags: '', steps: '', expectedResult: '',
        modulFitur: '', userStoryCoverage: '', tipeTest: 'Functional', userRole: '',
        tujuanPengujian: '', langkahUji: '', validasiDataUji: '', hasilYangDiharapkan: '',
        picQA: '', statusSIT: 'Not Started', dateSITExecuted: '', dateSITDone: '',
        objectTestVersion: 'v1.0.0', apiVersion: 'v1.0', testScenarioVersion: 'v1.0',
      });
      setShowTestCaseForm(false); setError(''); setInfo('Test case created successfully.');
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not create test case.'); }
  };

  const createTestRun = async () => {
    if (!canManageCycles && !canWriteTC) { setError('Permission denied.'); return; }
    if (!newTestRun.projectId || !newTestRun.name) { setError('Project and test run name are required.'); return; }
    try {
      const r = await axios.post(`${API_URL}/test-runs`, newTestRun, { headers: getAuthHeaders(token) });
      setNewTestRun({ projectId: '', name: '', status: 'Planned', cycleId: '', testCaseIds: [] });
      setShowTestRunForm(false);
      setInfo(`Test run created: ${r.data.caseCount} cases, est. ${formatMinutes(r.data.estimatedMinutes)}`);
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not create test run.'); }
  };

  const updateDefectStatus = async (id, status) => {
    try {
      await axios.patch(`${API_URL}/defects/${id}/status`, { status }, { headers: getAuthHeaders(token) });
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not update defect status.'); }
  };

  const updateUserRole = async (userId, role) => {
    if (!isAdmin) { setError('Only QA Lead can update roles.'); return; }
    try {
      await axios.patch(`${API_URL}/admin/users/${userId}/role`, { role }, { headers: getAuthHeaders(token) });
      setInfo('Role updated.'); await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not update user role.'); }
  };

  const exportCsv = (records, fileName) => {
    if (!records || !records.length) { setError('No records to export.'); return; }
    const headers = Object.keys(records[0]);
    const rows = [headers.join(',')];
    records.forEach((record) => {
      const values = headers.map((header) => {
        const raw = record[header] ?? '';
        const value = String(raw).replace(/"/g, '""');
        return `"${value}"`;
      });
      rows.push(values.join(','));
    });
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName; link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportXlsx = (records, fileName) => {
    if (!records || !records.length) { setError('No records to export.'); return; }
    const rows = flattenData(records);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, fileName);
  };

  const downloadTemplate = async () => {
    try {
      const res = await axios.get(`${API_URL}/test-cases/template`, {
        headers: getAuthHeaders(token), responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.download = 'test-scenario-template.csv'; link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const headers = ['No','Project','Test Case ID','Modul & Fitur','User Story Coverage','Tipe Test','User / Role','Tujuan Pengujian','Langkah Uji','Validasi Data Uji','Hasil Yang Diharapkan','PIC QA','Status SIT','Date SIT Executed','Date SIT Done','Object Test Version','API Version','Test Scenario Version'];
      const sample = [headers, [1,'Core Platform','CP-001','Auth Module','US-001','Functional','Teller','Verify login','1. Open login\n2. Enter credentials','Valid user data','Dashboard loaded','QA-01','Not Started','','','v1.0.0','v2.1.0','v1.0']];
      const csv = sample.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'test-scenario-template.csv'; link.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const importWorkbook = async (event, target = 'requirements') => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) { setError('No rows were found in the selected file.'); return; }

      if (target === 'requirements') {
        const nextRecords = rows.map((row, index) => ({
          id: `${target}-${Date.now()}-${index}`,
          title: row.title || row.Title || row['Requirement Title'] || `Imported Requirement ${index + 1}`,
          project_name: row.project_name || row.Project || row.project || 'Imported',
          priority: row.priority || row.Priority || 'Medium',
          status: row.status || row.Status || 'Draft',
          source: row.source || row.Source || 'Business',
        }));
        setData((d) => ({ ...d, requirements: [...nextRecords, ...(d.requirements || [])] }));
        setInfo(`Imported ${nextRecords.length} requirements (preview). Bulk save via API requires server config.`);
      } else if (target === 'testCases') {
        if (!canBulkImport) { setError('Permission denied for bulk import.'); return; }
        setInfo(`Processing ${rows.length} rows...`);
        const r = await axios.post(`${API_URL}/test-cases/bulk`, { items: rows, projectId: newTestCase.projectId || undefined }, { headers: getAuthHeaders(token) });
        setInfo(`Bulk imported ${r.data.imported} test cases successfully.`);
        setSelectedScenarios([]);
        await loadDashboard();
      }
      setError('');
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Unable to import the selected file.');
    }
  };

  const uploadRequirementPDF = async (event) => {
    if (!canUploadRequirements) { setError('Permission denied.'); return; }
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setPdfUpload((p) => ({ ...p, uploading: true }));
      setError('');
      const form = new FormData();
      form.append('file', file);
      if (pdfUpload.projectId) form.append('projectId', pdfUpload.projectId);
      if (pdfUpload.requirementId) form.append('requirementId', pdfUpload.requirementId);
      const res = await axios.post(`${API_URL}/requirements/upload-pdf`, form, {
        headers: { ...getAuthHeaders(token), 'Content-Type': 'multipart/form-data' },
      });
      setData((d) => ({
        ...d,
        userStoriesFromPDF: res.data.userStories || [],
        docUploads: [res.data.document, ...(d.docUploads || [])],
      }));
      setInfo(`PDF processed: ${res.data.ragChunkCount} text chunks, ${(res.data.userStories || []).length} user stories extracted.`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to process PDF.');
    } finally {
      setPdfUpload((p) => ({ ...p, uploading: false }));
    }
  };

  const generateScenarios = async () => {
    if (!canGenerateScenarios) { setError('Permission denied.'); return; }
    try {
      setInfo('Generating scenarios...');
      const body = { ...scenarioGen };
      if (data.userStoriesFromPDF?.length && !body.projectId && !body.requirementId) {
        body.userStories = data.userStoriesFromPDF;
      }
      const res = await axios.post(`${API_URL}/test-scenarios/generate`, body, { headers: getAuthHeaders(token) });
      setData((d) => ({ ...d, generatedScenarios: res.data.scenarios || [], userStoriesFromPDF: res.data.userStories || d.userStoriesFromPDF }));
      setSelectedScenarios([]);
      setInfo(`Generated ${res.data.scenarioCount} test scenarios from ${res.data.storyCount} user stories.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate scenarios.');
    }
  };

  const saveGeneratedScenarios = async () => {
    if (!canWriteTC && !canBulkImport) { setError('Permission denied.'); return; }
    const toSave = (selectedScenarios.length ? data.generatedScenarios.filter((_, i) => selectedScenarios.includes(i)) : data.generatedScenarios);
    if (!toSave.length) { setError('No scenarios selected or generated.'); return; }
    try {
      const items = toSave.map((s) => ({
        'Project': (data.projects.find((p) => String(p.id) === String(scenarioGen.projectId))?.name) || (data.projects[0]?.name) || 'Imported',
        'Test Case ID': s.code,
        'Modul & Fitur': s.modul_fitur || s.title,
        'User Story Coverage': s.user_story_coverage || '',
        'Tipe Test': s.tipe_test || 'Functional',
        'User / Role': s.user_role || s.userRole || '',
        'Tujuan Pengujian': s.tujuan_pengujian || s.summary || '',
        'Langkah Uji': s.langkah_uji || s.steps || '',
        'Validasi Data Uji': s.validasi_data_uji || '',
        'Hasil Yang Diharapkan': s.hasil_yang_diharapkan || s.expected_result || '',
        'PIC QA': s.pic_qa || s.picQA || user?.name || '',
        'Status SIT': s.status_sit || 'Not Started',
        'Object Test Version': s.object_test_version || 'v1.0.0',
        'API Version': s.api_version || 'v1.0',
        'Test Scenario Version': s.test_scenario_version || 'v1.0',
        'Severity': s.severity || 'Medium',
        'Priority': s.priority || 'Medium',
      }));
      const r = await axios.post(`${API_URL}/test-cases/bulk`, { items, projectId: scenarioGen.projectId || undefined }, { headers: getAuthHeaders(token) });
      setInfo(`Saved ${r.data.imported} generated scenarios.`);
      setSelectedScenarios([]);
      setData((d) => ({ ...d, generatedScenarios: [] }));
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save scenarios.'); }
  };

  const toggleScenarioSelection = (idx) => {
    setSelectedScenarios((cur) => cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx]);
  };

  const computeEstimate = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (estimateScope.projectId) params.set('projectId', estimateScope.projectId);
      if (estimateScope.runId) params.set('runId', estimateScope.runId);
      if (estimateScope.cycleId) params.set('cycleId', estimateScope.cycleId);
      const res = await axios.get(`${API_URL}/reports/estimate?${params.toString()}`, { headers: getAuthHeaders(token) });
      setData((d) => ({ ...d, estimate: res.data }));
      setInfo('Test time estimate computed.');
    } catch (err) { setError(err.response?.data?.message || 'Failed to compute estimate.'); }
    finally { setLoading(false); }
  };

  const refreshAdvanced = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.projectId) params.set('projectId', filters.projectId);
      const res = await axios.get(`${API_URL}/reports/advanced?${params.toString()}`, { headers: getAuthHeaders(token) });
      setData((d) => ({ ...d, advanced: res.data }));
    } catch (err) { setError(err.response?.data?.message || 'Failed to refresh reports.'); }
  };

  const generatePDFReportBackend = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.projectId) params.set('projectId', filters.projectId);
      const res = await axios.get(`${API_URL}/reports/pdf?${params.toString()}`, {
        headers: getAuthHeaders(token), responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url; link.download = `tcms-report-${Date.now()}.pdf`; link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      generatePDFReportFallback();
    }
  };

  const generatePDFReportFallback = () => {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(30, 58, 138);
      doc.text('TCMS QA Report', 40, 60);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 80);
      doc.text(`User: ${user?.name || ''} (${user?.email || ''})`, 40, 96);

      const a = data.advanced || {};
      const s = a.summary || {};

      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text('Executive Summary', 40, 130);

      const summaryRows = [
        ['Total Test Cases', s.testCasesTotal || 0],
        ['Passed', s.testCasesPassed || 0],
        ['Failed', s.testCasesFailed || 0],
        ['Draft', s.testCasesDraft || 0],
        ['Review', s.testCasesReview || 0],
        ['Pass Rate', `${s.passRate || 0}%`],
        ['Total Defects', s.defectsTotal || 0],
        ['Open Defects', s.defectsOpen || 0],
        ['Resolved', s.defectsResolved || 0],
        ['Resolution Rate', `${s.defectResolutionRate || 0}%`],
        ['Est. Effort (hrs)', s.estimatedTotalMinutes ? +((s.estimatedTotalMinutes || 0) / 60).toFixed(1) : 0],
      ];
      autoTable(doc, {
        startY: 145, head: [['Metric', 'Value']], body: summaryRows,
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 10 },
      });

      const byStatusBody = (a.byStatus || []).map((r) => [r.status, r.count, Math.round((r.count / Math.max(1, s.testCasesTotal || 1)) * 100) + '%']);
      if (byStatusBody.length) {
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 138);
        doc.text('Test Case Status Distribution', 40, (doc.lastAutoTable?.finalY || 220) + 30);
        autoTable(doc, {
          startY: (doc.lastAutoTable?.finalY || 220) + 40,
          head: [['Status', 'Count', '%']], body: byStatusBody,
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          alternateRowStyles: { fillColor: [239, 246, 255] },
          styles: { fontSize: 10 },
        });
      }

      const defBody = (a.byDefectStatus || []).map((r) => [r.status, r.count]);
      if (defBody.length) {
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 138);
        doc.text('Defects by Status', 40, (doc.lastAutoTable?.finalY || 400) + 30);
        autoTable(doc, {
          startY: (doc.lastAutoTable?.finalY || 400) + 40,
          head: [['Status', 'Count']], body: defBody,
          headStyles: { fillColor: [14, 165, 233], textColor: 255 },
          alternateRowStyles: { fillColor: [224, 242, 254] },
          styles: { fontSize: 10 },
        });
      }

      const traceBody = (a.traceability || []).slice(0, 20).map((t) => [
        String(t.requirementTitle || '').slice(0, 40),
        t.projectName || '', t.testCasesLinked || 0, `${t.coveragePercent || 0}%`,
      ]);
      if (traceBody.length) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 138);
        doc.text('Traceability Matrix', 40, 60);
        autoTable(doc, {
          startY: 70,
          head: [['Requirement', 'Project', 'TC Linked', 'Coverage%']],
          body: traceBody,
          headStyles: { fillColor: [30, 58, 138], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          styles: { fontSize: 9 },
        });
      }

      if (data.estimate) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(30, 58, 138);
        doc.text('Testing Time Estimation', 40, 60);
        const est = data.estimate;
        const estRows = [
          ['Total Test Cases', est.testCaseCount || 0],
          ['Base Execution (min)', est.baseExecutionMinutes || 0],
          ['Setup Overhead (min)', est.setupOverheadMinutes || 0],
          ['Review & Docs (min)', est.reviewAndDocumentationMinutes || 0],
          ['Retest Buffer (min)', est.retestBufferMinutes || 0],
          ['Total Estimate (hrs)', est.totalEstimatedHours || 0],
          ['Optimistic (hrs)', est.optimisticHours || 0],
          ['Pessimistic (hrs)', est.pessimisticHours || 0],
          ['Working Days (6hrs/day)', est.estimatedWorkingDays || 0],
        ];
        autoTable(doc, {
          startY: 75, head: [['Item', 'Value']], body: estRows,
          headStyles: { fillColor: [22, 163, 74], textColor: 255 },
          alternateRowStyles: { fillColor: [220, 252, 231] },
          styles: { fontSize: 10 },
        });
      }

      doc.save(`tcms-report-${Date.now()}.pdf`);
      setInfo('PDF report generated.');
    } catch (err) {
      setError('Failed: ' + err.message);
    }
  };

  const filteredTestCases = useMemo(() => {
    const tcs = data.testCases || [];
    return tcs.filter((tc) => {
      if (filters.projectId && String(tc.project_id) !== String(filters.projectId)) return false;
      if (filters.status && tc.status !== filters.status) return false;
      if (filters.severity && tc.severity !== filters.severity) return false;
      if (filters.priority && tc.priority !== filters.priority) return false;
      if (filters.tipeTest && tc.tipe_test !== filters.tipeTest) return false;
      if (filters.statusSIT && tc.status_sit !== filters.statusSIT) return false;
      if (filters.modulFitur && !(tc.modul_fitur || '').toLowerCase().includes(filters.modulFitur.toLowerCase())) return false;
      if (filters.userStoryCoverage && !(tc.user_story_coverage || '').toLowerCase().includes(filters.userStoryCoverage.toLowerCase())) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const hay = `${tc.code || ''} ${tc.title || ''} ${tc.summary || ''} ${tc.modul_fitur || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [data.testCases, filters]);

  const renderOverview = () => {
    const adv = data.advanced;
    return (
      <>
        <section className="stat-grid">
          {summaryCards.map((card) => (
            <div key={card.label} className={`summary-card ${card.tone}`}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          ))}
          {adv && (
            <>
              <div className="summary-card green">
                <span>Pass Rate</span>
                <strong>{adv.summary?.passRate || 0}%</strong>
                <small>of TC results</small>
              </div>
              <div className="summary-card blue">
                <span>Defect Resol.</span>
                <strong>{adv.summary?.defectResolutionRate || 0}%</strong>
                <small>Defects closed</small>
              </div>
              <div className="summary-card amber">
                <span>TC In Draft</span>
                <strong>{adv.summary?.testCasesDraft || 0}</strong>
                <small>Awaiting review</small>
              </div>
              <div className="summary-card rose">
                <span>Est. Hours</span>
                <strong>{adv.timeEstimate?.totalHours || 0}</strong>
                <small>Testing effort</small>
              </div>
            </>
          )}
        </section>

        <section className="dashboard-grid">
          <div className="panel large-panel">
            <div className="panel-header">
              <h3>Status Distribution</h3>
              <span>Current cycle</span>
            </div>
            <div className="bar-chart">
              {statusSummary.map((item) => (
                <div key={item.label} className="bar-stack">
                  <div className="bar-label-row">
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max((item.count / Math.max(data.overview?.summary?.testCases || 1, 1)) * 100, 8)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Severity</h3>
              <span>Distribution</span>
            </div>
            <div className="severity-list">
              {(data.overview?.bySeverity || []).map((item) => (
                <div key={item.severity} className="severity-item">
                  <span>{item.severity}</span>
                  <div className="severity-meter">
                    <div
                      className="severity-fill"
                      style={{ width: `${(item.count / Math.max(data.overview?.summary?.testCases || 1, 1)) * 100}%` }}
                    />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="two-column-grid">
          <div className="panel">
            <div className="panel-header">
              <h3>Recent Test Cases</h3>
              <span>Latest updates</span>
            </div>
            <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {(data.overview?.latestCases || []).slice(0, 6).map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.code}</strong></td>
                    <td>{item.project_name}</td>
                    <td><span className="status-badge status-pass">{item.status}</span></td>
                    <td>{item.severity}</td>
                    <td>{item.tipe_test || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Team Coverage</h3>
              <span>Active users</span>
            </div>
            <div className="team-grid">
              {(data.users || []).slice(0, 6).map((member) => (
                <div key={member.id} className="team-card">
                  <div className="team-avatar">{member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
                  <div>
                    <strong>{member.name}</strong>
                    <span>{roleMeta[member.role]?.label || member.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </>
    );
  };

  const renderRequirements = () => (
    <div className="panel full-height-panel">
      <div className="panel-header with-actions">
        <h3>Requirement Traceability</h3>
        <div className="inline-actions">
          <button className="primary-button small" onClick={() => exportCsv(data.requirements, 'requirements.csv')}>Export CSV</button>
          <button className="secondary-button small" onClick={() => exportXlsx(data.requirements, 'requirements.xlsx')}>Export XLSX</button>
        </div>
      </div>

      <div className="form-grid two-columns">
        <select value={newRequirement.projectId} onChange={(e) => setNewRequirement({ ...newRequirement, projectId: e.target.value })}>
          <option value="">Select project</option>
          {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="text" placeholder="Requirement title" value={newRequirement.title} onChange={(e) => setNewRequirement({ ...newRequirement, title: e.target.value })} />
        <input type="text" placeholder="Source (e.g. Business, Jira)" value={newRequirement.source} onChange={(e) => setNewRequirement({ ...newRequirement, source: e.target.value })} />
        <select value={newRequirement.priority} onChange={(e) => setNewRequirement({ ...newRequirement, priority: e.target.value })}>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <input type="text" placeholder="User Story (As a X, I want Y...)" value={newRequirement.userStory} onChange={(e) => setNewRequirement({ ...newRequirement, userStory: e.target.value })} className="full-width" />
        <input type="text" placeholder="Acceptance Criteria" value={newRequirement.acceptanceCriteria} onChange={(e) => setNewRequirement({ ...newRequirement, acceptanceCriteria: e.target.value })} className="full-width" />
        <textarea className="full-width" rows="3" placeholder="Requirement description" value={newRequirement.description} onChange={(e) => setNewRequirement({ ...newRequirement, description: e.target.value })} />
      </div>
      <div className="button-row">
        <button className="primary-button" onClick={createRequirement}>Create Requirement</button>
      </div>

      <div className="pdf-upload-section">
        <h4>Upload Requirement PDF (RAG Analysis)</h4>
        <div className="form-grid two-columns">
          <select value={pdfUpload.projectId} onChange={(e) => setPdfUpload({ ...pdfUpload, projectId: e.target.value })}>
            <option value="">Project for PDF (optional)</option>
            {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="file-button secondary-button">
            {pdfUpload.uploading ? 'Processing...' : 'Upload PDF Requirement'}
            <input type="file" accept=".pdf" disabled={pdfUpload.uploading || !canUploadRequirements} onChange={uploadRequirementPDF} />
          </label>
        </div>
        <small style={{ color: 'var(--muted)' }}>
          Upload a PDF requirement document. The system will extract text, create RAG chunks, and break down user stories for full test coverage.
        </small>
      </div>

      {data.userStoriesFromPDF?.length > 0 && (
        <div className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <h4>User Stories Extracted from PDF ({data.userStoriesFromPDF.length})</h4>
            <span>RAG → User Stories → Scenarios</span>
          </div>
          <div className="stories-grid">
            {data.userStoriesFromPDF.map((story, idx) => (
              <div key={idx} className="story-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <strong>{story.id || `US-${idx + 1}`}</strong>
                  <span className={`chip ${story.priority === 'High' ? 'red' : story.priority === 'Medium' ? 'amber' : 'gray'}`}>{story.priority || 'Medium'}</span>
                </div>
                <small>{(story.title || story.description || '').slice(0, 200)}</small>
              </div>
            ))}
          </div>
          <div className="button-row" style={{ marginTop: '10px' }}>
            <button className="primary-button small" onClick={generateScenarios}>Generate Test Scenarios from Stories</button>
            <button className="secondary-button small" onClick={() => setData((d) => ({ ...d, userStoriesFromPDF: [] }))}>Clear</button>
          </div>
        </div>
      )}

      <div className="scroll-x" style={{ marginTop: '18px' }}>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Project</th>
            <th>Priority</th>
            <th>Source</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(data.requirements || []).map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.project_name}</td>
              <td>{item.priority}</td>
              <td>{item.source}</td>
              <td><span className="status-badge status-pass">{item.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );

  const renderTestCases = () => (
    <div className="panel full-height-panel">
      <div className="panel-header with-actions">
        <h3>Test Case Management ({filteredTestCases.length})</h3>
        <div className="inline-actions">
          {canWriteTC && (
            <button className="primary-button small" onClick={() => setShowTestCaseForm(!showTestCaseForm)}>
              {showTestCaseForm ? 'Hide Form' : 'New Test Case'}
            </button>
          )}
          <button className="secondary-button small" onClick={downloadTemplate}>Download Template</button>
          <button className="secondary-button small" onClick={() => exportCsv(filteredTestCases, 'test-cases.csv')}>Export CSV</button>
          <button className="secondary-button small" onClick={() => exportXlsx(filteredTestCases, 'test-cases.xlsx')}>Export XLSX</button>
          {canBulkImport && (
            <label className="secondary-button small file-button">
              Bulk Upload
              <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => importWorkbook(e, 'testCases')} />
            </label>
          )}
        </div>
      </div>

      <div className="reports-filters">
        <div>
          <label>Project</label>
          <select value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}>
            <option value="">All</option>
            {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label>Status</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All</option>
            {testCaseStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Severity</label>
          <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
            <option value="">All</option>
            {testCaseSeverities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Priority</label>
          <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
            <option value="">All</option>
            {testCasePriorities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Tipe Test</label>
          <select value={filters.tipeTest} onChange={(e) => setFilters({ ...filters, tipeTest: e.target.value })}>
            <option value="">All</option>
            {(data.tipeTestOptions || tipeTestDefaults).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Status SIT</label>
          <select value={filters.statusSIT} onChange={(e) => setFilters({ ...filters, statusSIT: e.target.value })}>
            <option value="">All</option>
            {sitStatusDefaults.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Search</label>
          <input type="text" placeholder="Code / Title..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <div>
          <label>User Story</label>
          <input type="text" placeholder="US coverage..." value={filters.userStoryCoverage} onChange={(e) => setFilters({ ...filters, userStoryCoverage: e.target.value })} />
        </div>
      </div>

      {showTestCaseForm && canWriteTC && (
        <div className="form-grid two-columns">
          <div>
            <label className="field-label">Project *</label>
            <select value={newTestCase.projectId} onChange={(e) => setNewTestCase({ ...newTestCase, projectId: e.target.value })}>
              <option value="">Select project</option>
              {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Test Case ID *</label>
            <input type="text" placeholder="e.g. CP-101" value={newTestCase.code} onChange={(e) => setNewTestCase({ ...newTestCase, code: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Test Case Title *</label>
            <input type="text" value={newTestCase.title} onChange={(e) => setNewTestCase({ ...newTestCase, title: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Modul & Fitur</label>
            <input type="text" value={newTestCase.modulFitur} onChange={(e) => setNewTestCase({ ...newTestCase, modulFitur: e.target.value })} />
          </div>
          <div>
            <label className="field-label">User Story Coverage</label>
            <input type="text" placeholder="US-001, US-002" value={newTestCase.userStoryCoverage} onChange={(e) => setNewTestCase({ ...newTestCase, userStoryCoverage: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Tipe Test</label>
            <select value={newTestCase.tipeTest} onChange={(e) => setNewTestCase({ ...newTestCase, tipeTest: e.target.value })}>
              {(data.tipeTestOptions || tipeTestDefaults).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">User / Role</label>
            <select value={newTestCase.userRole} onChange={(e) => setNewTestCase({ ...newTestCase, userRole: e.target.value })}>
              <option value="">Select</option>
              {(data.userRoleOptions || userRoleDefaults).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Status SIT</label>
            <select value={newTestCase.statusSIT} onChange={(e) => setNewTestCase({ ...newTestCase, statusSIT: e.target.value })}>
              {sitStatusDefaults.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Severity</label>
            <select value={newTestCase.severity} onChange={(e) => setNewTestCase({ ...newTestCase, severity: e.target.value })}>
              {testCaseSeverities.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Priority</label>
            <select value={newTestCase.priority} onChange={(e) => setNewTestCase({ ...newTestCase, priority: e.target.value })}>
              {testCasePriorities.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">PIC QA</label>
            <input type="text" value={newTestCase.picQA} onChange={(e) => setNewTestCase({ ...newTestCase, picQA: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Status TC</label>
            <select value={newTestCase.status} onChange={(e) => setNewTestCase({ ...newTestCase, status: e.target.value })}>
              {testCaseStatuses.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Tujuan Pengujian</label>
            <textarea rows="3" value={newTestCase.tujuanPengujian} onChange={(e) => setNewTestCase({ ...newTestCase, tujuanPengujian: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Summary</label>
            <textarea rows="3" value={newTestCase.summary} onChange={(e) => setNewTestCase({ ...newTestCase, summary: e.target.value })} />
          </div>
          <div className="full-width">
            <label className="field-label">Langkah Uji (Steps)</label>
            <textarea rows="5" value={newTestCase.langkahUji} onChange={(e) => setNewTestCase({ ...newTestCase, langkahUji: e.target.value, steps: e.target.value })} />
          </div>
          <div className="full-width">
            <label className="field-label">Validasi Data Uji</label>
            <textarea rows="3" value={newTestCase.validasiDataUji} onChange={(e) => setNewTestCase({ ...newTestCase, validasiDataUji: e.target.value })} />
          </div>
          <div className="full-width">
            <label className="field-label">Hasil Yang Diharapkan</label>
            <textarea rows="4" value={newTestCase.hasilYangDiharapkan} onChange={(e) => setNewTestCase({ ...newTestCase, hasilYangDiharapkan: e.target.value, expectedResult: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Date SIT Executed</label>
            <input type="date" value={newTestCase.dateSITExecuted} onChange={(e) => setNewTestCase({ ...newTestCase, dateSITExecuted: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Date SIT Done</label>
            <input type="date" value={newTestCase.dateSITDone} onChange={(e) => setNewTestCase({ ...newTestCase, dateSITDone: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Object Test Version</label>
            <input type="text" value={newTestCase.objectTestVersion} onChange={(e) => setNewTestCase({ ...newTestCase, objectTestVersion: e.target.value })} />
          </div>
          <div>
            <label className="field-label">API Version</label>
            <input type="text" value={newTestCase.apiVersion} onChange={(e) => setNewTestCase({ ...newTestCase, apiVersion: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Test Scenario Version</label>
            <input type="text" value={newTestCase.testScenarioVersion} onChange={(e) => setNewTestCase({ ...newTestCase, testScenarioVersion: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Tags</label>
            <input type="text" value={newTestCase.tags} onChange={(e) => setNewTestCase({ ...newTestCase, tags: e.target.value })} />
          </div>
          <div className="button-row">
            <button className="primary-button" onClick={createTestCase}>Create Test Case</button>
            <button className="secondary-button" onClick={() => setShowTestCaseForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="generate-section">
        <h4>Generate Test Scenarios (AI)</h4>
        <div className="form-grid three-columns">
          <select value={scenarioGen.projectId} onChange={(e) => setScenarioGen({ ...scenarioGen, projectId: e.target.value })}>
            <option value="">Project (optional)</option>
            {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={scenarioGen.requirementId} onChange={(e) => setScenarioGen({ ...scenarioGen, requirementId: e.target.value })}>
            <option value="">From Requirement (optional)</option>
            {(data.requirements || []).map((r) => <option key={r.id} value={r.id}>{r.title?.slice(0, 40)}</option>)}
          </select>
          <input type="text" placeholder="Code Prefix (e.g. CP)" value={scenarioGen.prefix} onChange={(e) => setScenarioGen({ ...scenarioGen, prefix: e.target.value })} />
        </div>
        <div className="checkbox-row">
          <input type="checkbox" id="fullCoverage" checked={scenarioGen.fullCoverage} onChange={(e) => setScenarioGen({ ...scenarioGen, fullCoverage: e.target.checked })} />
          <label htmlFor="fullCoverage">Full coverage (4 variants / user story)</label>
        </div>
        <div className="button-row">
          <button className="primary-button small" onClick={generateScenarios} disabled={!canGenerateScenarios}>Generate Scenarios</button>
          {data.generatedScenarios?.length > 0 && (
            <>
              <button className="secondary-button small" onClick={saveGeneratedScenarios} disabled={!canWriteTC && !canBulkImport}>Save Scenarios ({selectedScenarios.length || 'all'})</button>
              <button className="ghost-button small" onClick={() => setSelectedScenarios(data.generatedScenarios.map((_, i) => i))}>Select All</button>
              <button className="ghost-button small" onClick={() => setSelectedScenarios([])}>Clear Selection</button>
              <button className="ghost-button small" onClick={() => setData((d) => ({ ...d, generatedScenarios: [] }))}>Discard</button>
            </>
          )}
        </div>
      </div>

      {data.generatedScenarios?.length > 0 && (
        <div className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <h4>Generated Scenarios ({data.generatedScenarios.length})</h4>
            <span>Select and save to create test cases</span>
          </div>
          <div className="scenarios-grid">
            {data.generatedScenarios.map((sc, idx) => (
              <div key={idx} className="scenario-card" style={{ border: selectedScenarios.includes(idx) ? '2px solid #2563eb' : undefined }}>
                <div className="checkbox-row">
                  <input type="checkbox" id={`sc-${idx}`} checked={selectedScenarios.includes(idx)} onChange={() => toggleScenarioSelection(idx)} />
                  <label htmlFor={`sc-${idx}`} style={{ fontWeight: 700 }}>{sc.code} - {sc.title?.slice(0, 80)}</label>
                </div>
                <small>
                  <span className="chip">{sc.tipe_test || 'Functional'}</span>
                  <span className={`chip ${sc.severity === 'Critical' ? 'red' : sc.severity === 'Major' ? 'amber' : 'gray'}`}>{sc.severity || 'Major'}</span>
                  <span className="chip">{sc.user_story_coverage || '-'}</span>
                </small>
                <small style={{ color: 'var(--muted)', marginTop: '4px' }}>
                  {(sc.tujuan_pengujian || sc.summary || '').slice(0, 160)}
                </small>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="scroll-x" style={{ marginTop: '18px' }}>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title / Modul Fitur</th>
            <th>Project</th>
            <th>Tipe Test</th>
            <th>Severity</th>
            <th>Priority</th>
            <th>Status TC</th>
            <th>Status SIT</th>
            <th>User Story</th>
            <th>PIC QA</th>
          </tr>
        </thead>
        <tbody>
          {filteredTestCases.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.code}</strong></td>
              <td>{item.title || item.modul_fitur}</td>
              <td>{item.project_name}</td>
              <td>{item.tipe_test || '-'}</td>
              <td>{item.severity}</td>
              <td>{item.priority}</td>
              <td><span className="status-badge status-pass">{item.status}</span></td>
              <td><span className={`status-badge ${item.status_sit === 'Passed' ? 'status-pass' : item.status_sit === 'Failed' ? 'status-danger' : 'status-warn'}`}>{item.status_sit || '-'}</span></td>
              <td>{item.user_story_coverage || '-'}</td>
              <td>{item.pic_qa || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );

  const renderCycles = () => (
    <div className="panel full-height-panel">
      <div className="panel-header with-actions">
        <h3>Test Cycle Planning</h3>
        <div className="inline-actions">
          <button className="primary-button small" onClick={() => exportCsv(data.cycles, 'test-cycles.csv')}>Export CSV</button>
        </div>
      </div>

      {canManageCycles && (
        <>
          <div className="form-grid two-columns">
            <select value={newCycle.projectId} onChange={(e) => setNewCycle({ ...newCycle, projectId: e.target.value })}>
              <option value="">Select project</option>
              {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="text" placeholder="Cycle name" value={newCycle.name} onChange={(e) => setNewCycle({ ...newCycle, name: e.target.value })} />
            <select value={newCycle.status} onChange={(e) => setNewCycle({ ...newCycle, status: e.target.value })}>
              <option value="Planned">Planned</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
            </select>
            <textarea className="full-width" rows="3" placeholder="Cycle summary" value={newCycle.summary} onChange={(e) => setNewCycle({ ...newCycle, summary: e.target.value })} />
          </div>
          <div className="button-row">
            <button className="primary-button" onClick={createCycle}>Create Cycle</button>
          </div>
        </>
      )}

      <div className="scroll-x">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Project</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Cases</th>
            <th>Estimate</th>
          </tr>
        </thead>
        <tbody>
          {(data.cycles || []).map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.project_name}</td>
              <td>{item.owner_name}</td>
              <td><span className="status-badge status-pass">{item.status}</span></td>
              <td>{item.total_cases || 0}</td>
              <td>{formatMinutes(item.estimated_minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );

  const renderTestRuns = () => (
    <div className="panel full-height-panel">
      <div className="panel-header with-actions">
        <h3>Test Runs ({(data.testRuns || []).length})</h3>
        <div className="inline-actions">
          <button className="secondary-button small" onClick={() => exportCsv(data.testRuns, 'test-runs.csv')}>Export CSV</button>
        </div>
      </div>

      {!showTestRunForm && (
        <div className="button-row" style={{ marginBottom: '12px' }}>
          {(canManageCycles || canWriteTC) && (
            <button className="primary-button small" onClick={() => setShowTestRunForm(true)}>Create Test Run</button>
          )}
        </div>
      )}

      {showTestRunForm && (canManageCycles || canWriteTC) && (
        <div className="form-grid two-columns">
          <select value={newTestRun.projectId} onChange={(e) => setNewTestRun({ ...newTestRun, projectId: e.target.value })}>
            <option value="">Select project</option>
            {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="text" placeholder="Test run name" value={newTestRun.name} onChange={(e) => setNewTestRun({ ...newTestRun, name: e.target.value })} />
          <select value={newTestRun.cycleId} onChange={(e) => setNewTestRun({ ...newTestRun, cycleId: e.target.value })}>
            <option value="">Cycle (optional)</option>
            {(data.cycles || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={newTestRun.status} onChange={(e) => setNewTestRun({ ...newTestRun, status: e.target.value })}>
            <option value="Planned">Planned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <div className="button-row">
            <button className="primary-button" onClick={createTestRun}>Create Test Run</button>
            <button className="secondary-button" onClick={() => setShowTestRunForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="scroll-x">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Project</th>
            <th>Status</th>
            <th>Created By</th>
            <th>Total</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Est.</th>
          </tr>
        </thead>
        <tbody>
          {(data.testRuns || []).map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.project_name}</td>
              <td><span className="status-badge status-pass">{item.status}</span></td>
              <td>{item.created_by_name}</td>
              <td>{item.total_cases || 0}</td>
              <td><span className="chip green">{item.passed || 0}</span></td>
              <td><span className="chip red">{item.failed || 0}</span></td>
              <td>{formatMinutes(item.estimated_minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );

  const renderExecutionBoard = () => (
    <div className="panel full-height-panel">
      <div className="panel-header with-actions">
        <h3>Execution Board</h3>
        <div className="inline-actions">
          <button className="primary-button small" onClick={() => exportCsv(data.executions, 'execution-board.csv')}>Export CSV</button>
          <button className="secondary-button small" onClick={() => exportXlsx(data.executions, 'execution-board.xlsx')}>Export XLSX</button>
        </div>
      </div>

      <div className="kanban-grid">
        {['Not Executed', 'Passed', 'Failed', 'Retest'].map((phase) => (
          <div key={phase} className="kanban-column">
            <div className="kanban-header">{phase} ({(data.executions || []).filter((i) => i.status === phase).length})</div>
            {(data.executions || []).filter((item) => item.status === phase).slice(0, 12).map((item) => (
              <div key={item.id} className="kanban-card">
                <strong>{item.code}</strong>
                <span>{item.title || item.cycle_name}</span>
                <small>{item.project_name} • {item.cycle_name}</small>
                <small>Type: {item.tipe_test || '-'} • Sev: {item.severity}</small>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  const renderDefects = () => (
    <div className="panel full-height-panel">
      <div className="panel-header with-actions">
        <h3>Defect Workflow States ({(data.defects || []).length})</h3>
        <div className="inline-actions">
          <button className="primary-button small" onClick={() => exportCsv(data.defects, 'defects.csv')}>Export CSV</button>
          <button className="secondary-button small" onClick={() => exportXlsx(data.defects, 'defects.xlsx')}>Export XLSX</button>
        </div>
      </div>

      <div className="reports-filters">
        <div>
          <label>Project</label>
          <select value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}>
            <option value="">All</option>
            {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label>Status</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All</option>
            {(data.workflow || workflowStatus).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Severity</label>
          <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
            <option value="">All</option>
            {testCaseSeverities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Priority</label>
          <select value={filters.defectPriority} onChange={(e) => setFilters({ ...filters, defectPriority: e.target.value })}>
            <option value="">All</option>
            {testCasePriorities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="scroll-x">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Severity</th>
            <th>Priority</th>
            <th>Project</th>
            <th>Linked TC</th>
            <th>Assignee</th>
            <th>Status</th>
            <th>Update</th>
          </tr>
        </thead>
        <tbody>
          {(data.defects || []).filter((d) => {
            if (filters.projectId && String(d.project_id) !== String(filters.projectId)) return false;
            if (filters.status && d.status !== filters.status) return false;
            if (filters.severity && d.severity !== filters.severity) return false;
            if (filters.defectPriority && d.priority !== filters.defectPriority) return false;
            return true;
          }).map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.severity}</td>
              <td>{item.priority}</td>
              <td>{item.project_name}</td>
              <td>{item.test_case_code || '-'}</td>
              <td>{item.assignee_name || '-'}</td>
              <td><span className="status-badge status-danger">{item.status}</span></td>
              <td>
                <select value={item.status} onChange={(e) => updateDefectStatus(item.id, e.target.value)}>
                  {(data.workflow || workflowStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );

  const renderReports = () => {
    const adv = data.advanced;
    const est = data.estimate;
    const tcFilters = filters;
    return (
      <div className="panel full-height-panel">
        <div className="panel-header">
          <div>
            <h3>QA Reports & Analytics (Jira/Xray Style)</h3>
            <small>Real-time dashboard metrics and insights</small>
          </div>
          <div className="inline-actions">
            {canExportReports && (
              <>
                <button className="primary-button small" onClick={generatePDFReportBackend}>Generate PDF Report</button>
                <button className="secondary-button small" onClick={generatePDFReportFallback}>PDF (Fallback)</button>
                <button className="secondary-button small" onClick={refreshAdvanced}>Refresh Data</button>
              </>
            )}
          </div>
        </div>

        <div className="tab-row">
          {['summary', 'distribution', 'traceability', 'estimate'].map((t) => (
            <button key={t} className={reportTab === t ? 'active' : ''} onClick={() => setReportTab(t)}>
              {t.replace(/^\w/, (c) => c.toUpperCase()).replace(/-([a-z])/g, (_, c) => ' ' + c.toUpperCase())}
            </button>
          ))}
        </div>

        <div className="reports-filters">
          <div>
            <label>Project</label>
            <select value={tcFilters.projectId} onChange={(e) => { setFilters({ ...filters, projectId: e.target.value }); setEstimateScope({ ...estimateScope, projectId: e.target.value }); }}>
              <option value="">All Projects</option>
              {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label>Severity</label>
            <select value={tcFilters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
              <option value="">All Severities</option>
              {testCaseSeverities.map((sev) => <option key={sev} value={sev}>{sev}</option>)}
            </select>
          </div>
          <div>
            <label>Defect Status</label>
            <select value={tcFilters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Status</option>
              {(data.workflow || workflowStatus).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div>
            <label>Tipe Test</label>
            <select value={tcFilters.tipeTest} onChange={(e) => setFilters({ ...filters, tipeTest: e.target.value })}>
              <option value="">All</option>
              {(data.tipeTestOptions || tipeTestDefaults).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {reportTab === 'summary' && adv && (
          <>
            <section className="kpi-row">
              <div className="kpi-item"><strong>{adv.summary?.testCasesTotal || 0}</strong><small>Total TC</small></div>
              <div className="kpi-item"><strong>{adv.summary?.testCasesPassed || 0}</strong><small>Passed</small></div>
              <div className="kpi-item"><strong>{adv.summary?.testCasesFailed || 0}</strong><small>Failed</small></div>
              <div className="kpi-item"><strong>{adv.summary?.testCasesDraft || 0}</strong><small>Draft</small></div>
              <div className="kpi-item"><strong>{adv.summary?.testCasesReview || 0}</strong><small>Review</small></div>
              <div className="kpi-item"><strong>{adv.summary?.passRate || 0}%</strong><small>Pass Rate</small></div>
              <div className="kpi-item"><strong>{adv.summary?.defectsTotal || 0}</strong><small>Defects</small></div>
              <div className="kpi-item"><strong>{adv.summary?.defectsOpen || 0}</strong><small>Open Defects</small></div>
              <div className="kpi-item"><strong>{adv.summary?.defectsResolved || 0}</strong><small>Resolved</small></div>
              <div className="kpi-item"><strong>{adv.summary?.defectResolutionRate || 0}%</strong><small>Resolution</small></div>
              <div className="kpi-item"><strong>{adv.timeEstimate?.totalHours || 0}</strong><small>Est Hrs</small></div>
              <div className="kpi-item"><strong>{adv.timeEstimate?.totalWorkingDays || 0}</strong><small>Work Days</small></div>
            </section>
          </>
        )}

        {reportTab === 'distribution' && adv && (
          <div className="two-column-grid">
            <div className="panel">
              <div className="panel-header">
                <h4>TC by Status</h4>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {(adv.byStatus || []).map((item) => {
                    const total = adv.summary?.testCasesTotal || 1;
                    return (
                      <tr key={item.status}>
                        <td>{item.status}</td>
                        <td>{item.count}</td>
                        <td>{Math.round((item.count / Math.max(1, total)) * 100)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h4>TC by Severity</h4>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Count</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {(adv.bySeverity || []).map((item) => {
                    const total = adv.summary?.testCasesTotal || 1;
                    return (
                      <tr key={item.severity}>
                        <td>{item.severity}</td>
                        <td>{item.count}</td>
                        <td>{Math.round((item.count / Math.max(1, total)) * 100)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h4>TC by Priority</h4>
              </div>
              <table>
                <thead><tr><th>Priority</th><th>Count</th></tr></thead>
                <tbody>
                  {(adv.byPriority || []).map((item) => (<tr key={item.priority}><td>{item.priority}</td><td>{item.count}</td></tr>))}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h4>TC by Tipe Test</h4>
              </div>
              <table>
                <thead><tr><th>Tipe Test</th><th>Count</th></tr></thead>
                <tbody>
                  {(adv.byTipeTest || []).map((item) => (<tr key={item.tipe_test || 'none'}><td>{item.tipe_test || '-'}</td><td>{item.count}</td></tr>))}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h4>Defects by Status</h4>
              </div>
              <table>
                <thead><tr><th>Status</th><th>Count</th><th>%</th></tr></thead>
                <tbody>
                  {(adv.byDefectStatus || []).map((item) => {
                    const total = adv.summary?.defectsTotal || 1;
                    return (<tr key={item.status}><td>{item.status}</td><td>{item.count}</td><td>{Math.round((item.count / Math.max(1, total)) * 100)}%</td></tr>);
                  })}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h4>Defects by Severity</h4>
              </div>
              <table>
                <thead><tr><th>Severity</th><th>Count</th></tr></thead>
                <tbody>
                  {(adv.byDefectSeverity || []).map((item) => (<tr key={item.severity}><td>{item.severity}</td><td>{item.count}</td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportTab === 'traceability' && adv && (
          <div className="panel">
            <div className="panel-header">
              <h4>Traceability Matrix: Requirements → Test Cases → Defects</h4>
            </div>
            <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Project</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>TC Linked</th>
                  <th>Defects Found</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {(adv.traceability || []).map((t, idx) => (
                  <tr key={idx}>
                    <td>{t.requirementTitle}</td>
                    <td>{t.projectName}</td>
                    <td>{t.priority}</td>
                    <td><span className="status-badge status-pass">{t.status}</span></td>
                    <td>{t.testCasesLinked}</td>
                    <td>{t.defectsFound}</td>
                    <td><strong>{t.coveragePercent}%</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {reportTab === 'estimate' && (
          <div className="estimate-section">
            <h4>Testing Time Estimation</h4>
            <div className="form-grid two-columns">
              <select value={estimateScope.projectId} onChange={(e) => setEstimateScope({ ...estimateScope, projectId: e.target.value })}>
                <option value="">Project (optional)</option>
                {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={estimateScope.runId} onChange={(e) => setEstimateScope({ ...estimateScope, runId: e.target.value })}>
                <option value="">Test Run (optional)</option>
                {(data.testRuns || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="button-row" style={{ marginTop: '8px' }}>
              <button className="primary-button small" onClick={computeEstimate}>Compute Estimate</button>
            </div>

            {est && (
              <>
                <hr className="section-divider" />
                <section className="kpi-row">
                  <div className="kpi-item"><strong>{est.testCaseCount || 0}</strong><small>TC Count</small></div>
                  <div className="kpi-item"><strong>{formatMinutes(est.baseExecutionMinutes)}</strong><small>Base Exec</small></div>
                  <div className="kpi-item"><strong>{formatMinutes(est.setupOverheadMinutes)}</strong><small>Setup</small></div>
                  <div className="kpi-item"><strong>{formatMinutes(est.reviewAndDocumentationMinutes)}</strong><small>Review</small></div>
                  <div className="kpi-item"><strong>{formatMinutes(est.retestBufferMinutes)}</strong><small>Retest Buf</small></div>
                  <div className="kpi-item"><strong>{formatMinutes(est.totalEstimatedMinutes)}</strong><small>Total</small></div>
                  <div className="kpi-item"><strong>{est.totalEstimatedHours || 0}h</strong><small>Hours</small></div>
                  <div className="kpi-item"><strong>{est.estimatedWorkingDays || 0}</strong><small>Work Days</small></div>
                  <div className="kpi-item"><strong>{est.optimisticHours || 0}h</strong><small>Optimistic</small></div>
                  <div className="kpi-item"><strong>{est.pessimisticHours || 0}h</strong><small>Pessimistic</small></div>
                </section>

                <div className="panel" style={{ marginTop: '12px' }}>
                  <div className="panel-header"><h4>Per Case Estimate</h4></div>
                  <div className="scroll-x">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Title</th>
                        <th>Severity</th>
                        <th>Steps</th>
                        <th>Est. Minutes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(est.perCase || []).slice(0, 100).map((p) => (
                        <tr key={p.testCaseId}>
                          <td><strong>{p.code}</strong></td>
                          <td>{p.title?.slice(0, 50)}</td>
                          <td>{p.severity}</td>
                          <td>{p.stepsCount}</td>
                          <td>{p.estimatedMinutes} min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAdmin = () => (
    <div className="panel full-height-panel">
      <div className="panel-header">
        <h3>Admin Panel & Role Permissions</h3>
      </div>

      {!isAdmin && <div className="error-box">Only QA Lead can manage roles.</div>}

      <div className="admin-grid">
        {(data.admin.users || data.users || []).map((member) => (
          <div key={member.id} className="admin-card">
            <div>
              <strong>{member.name}</strong>
              <small>{member.email}</small>
            </div>
            <select disabled={!isAdmin} value={member.role} onChange={(event) => updateUserRole(member.id, event.target.value)}>
              {Object.entries(roleMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="permission-table">
        <h4>Permission Matrix (RBAC)</h4>
        <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.admin.rolePermissions || {}).map(([role, perms]) => (
              <tr key={role}>
                <td>{roleMeta[role]?.label || role}</td>
                <td>{Array.isArray(perms) ? perms.map((p) => <span key={p} className="chip">{p}</span>) : String(perms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'requirements': return renderRequirements();
      case 'test-cases': return renderTestCases();
      case 'test-cycles': return renderCycles();
      case 'test-runs': return renderTestRuns();
      case 'execution-board': return renderExecutionBoard();
      case 'defects': return renderDefects();
      case 'reports': return renderReports();
      case 'admin': return renderAdmin();
      case 'overview':
      default: return renderOverview();
    }
  };

  if (!token || !user) {
    return (
      <div className="auth-shell">
        <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
          <button type="button" className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
        <div className="login-panel">
          <div className="brand-block">
            <span className="eyebrow">Bank Ina Digital QA Suite</span>
            <h1>Bank Ina Digital</h1>
            <p>Enterprise-grade test case management, compliance, and defect workflow platform for digital banking QA. Full coverage with RAG and AI scenario generation.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="role-switcher">
              {Object.entries(roleMeta).map(([role, meta]) => (
                <button key={role} type="button" className={selectedRole === role ? 'role-chip active' : 'role-chip'} onClick={() => handleRoleChange(role)}>
                  {meta.label}
                </button>
              ))}
            </div>

            <label>
              Email
              <input type="email" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} placeholder="name@bankinadigital.com" />
            </label>

            <label>
              Password
              <input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Password123!" />
            </label>

            {error && <div className="error-box">{error}</div>}
            {info && <div className="info-box">{info}</div>}

            <div className="actions-row">
              <button type="submit" className="primary-button">Sign in</button>
              <button type="button" className="secondary-button" onClick={handleSSO}>SSO Login</button>
            </div>

            <div className="demo-box">
              <strong>Demo accounts</strong>
              <small>qa.lead@company.com / Password123!</small>
              <small>Select a role from chips above for credentials.</small>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-name">BID TCMS</div>
        <nav className="nav-menu">
          <span className="nav-label">Workflow</span>
          {navItems.map((item) => (
            <button key={item} type="button" className={activeTab === item ? 'nav-item active' : 'nav-item'} onClick={() => handleTabClick(item)}>
              {item.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
            </button>
          ))}
        </nav>

        <div className="user-card">
          <div className="user-avatar">{user.name.split(' ').map((item) => item[0]).slice(0, 2).join('')}</div>
          <div>
            <strong>{user.name}</strong>
            <span>{roleMeta[user.role]?.label}</span>
          </div>
        </div>

        <button className="logout-button" onClick={handleLogout}>Logout</button>
      </aside>

      <main className="content-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Quality Operations</p>
            <h2>Bank Ina Digital Test Management Console</h2>
          </div>
          <div className="topbar-actions">
            <button type="button" className="theme-toggle-btn" onClick={toggleTheme}>
              {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </button>
            <span className="badge" style={{ backgroundColor: roleMeta[userRole]?.color || '#1e3a8a' }}>
              {roleMeta[userRole]?.label || 'User'}
            </span>
            {(canManageCycles || canWriteTC) && (
              <button className="primary-button small" onClick={() => setShowTestRunForm(!showTestRunForm)}>
                {showTestRunForm ? 'Cancel' : 'New Test Run'}
              </button>
            )}
          </div>
        </header>


        {loading ? <div className="loading-box">Loading QA workspace...</div> : null}
        {error ? <div className="error-box">{error}</div> : null}
        {info ? <div className="info-box">{info}</div> : null}

        {showTestRunForm && activeTab !== 'test-runs' && (
          <div className="panel" style={{ marginBottom: '20px' }}>
            <div className="panel-header"><h3>Create New Test Run</h3></div>
            <div className="form-grid two-columns">
              <select value={newTestRun.projectId} onChange={(e) => setNewTestRun({ ...newTestRun, projectId: e.target.value })}>
                <option value="">Select project</option>
                {(data.projects || []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <input type="text" placeholder="Test run name" value={newTestRun.name} onChange={(e) => setNewTestRun({ ...newTestRun, name: e.target.value })} />
              <select value={newTestRun.cycleId} onChange={(e) => setNewTestRun({ ...newTestRun, cycleId: e.target.value })}>
                <option value="">Select execution cycle (optional)</option>
                {(data.cycles || []).map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
              </select>
              <select value={newTestRun.status} onChange={(e) => setNewTestRun({ ...newTestRun, status: e.target.value })}>
                <option value="Planned">Planned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
              <div className="button-row">
                <button className="primary-button" onClick={createTestRun}>Create Test Run</button>
                <button className="secondary-button" onClick={() => setShowTestRunForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {renderActiveTab()}
      </main>
    </div>
  );
}
