import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const roleMeta = {
  qa_lead: { label: 'QA Lead', color: '#0b1a33' },
  qa_engineer: { label: 'QA Engineer', color: '#1e3a5f' },
  product: { label: 'Product', color: '#b91c1c' },
  pm: { label: 'PM', color: '#e30613' },
  business_analyst: { label: 'Business Analyst', color: '#122545' },
};

const initialCredentials = {
  qa_lead: { email: 'qa.lead@company.com', password: 'Password123!' },
  qa_engineer: { email: 'qa.engineer@company.com', password: 'Password123!' },
  product: { email: 'product@company.com', password: 'Password123!' },
  pm: { email: 'pm@company.com', password: 'Password123!' },
  business_analyst: { email: 'business.analyst@company.com', password: 'Password123!' },
};

const workflowStatus = ['Open', 'In Progress', 'In Review', 'Rejected', 'Resolved', 'Closed'];
const navItems = [
  'overview', 'requirements', 'test-cases', 'test-suites', 'test-plans', 'test-cycles',
  'test-runs', 'execution-board', 'defects', 'traceability', 'reports', 'activity', 'admin',
];
const navLabels = {
  overview: 'Overview', requirements: 'Requirements', 'test-cases': 'Test Cases',
  'test-suites': 'Test Suites', 'test-plans': 'Test Plans', 'test-cycles': 'Test Cycles',
  'test-runs': 'Test Runs', 'execution-board': 'Execution Board', defects: 'Defects',
  traceability: 'Traceability', reports: 'Reports', activity: 'Activity', admin: 'Admin',
};
const reviewStatuses = ['Draft', 'In Review', 'Approved', 'Rejected', 'Deprecated'];
const executionStatuses = ['Not Executed', 'Passed', 'Failed', 'Retest', 'Blocked', 'Skipped'];
const runResultStatuses = ['Not Run', 'Passed', 'Failed', 'Blocked', 'Retest', 'Skipped'];
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
    suites: [], milestones: [], plans: [], sharedSteps: [], tags: [],
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
  const [showMdPreview, setShowMdPreview] = useState(true);
  const [selectedScenarios, setSelectedScenarios] = useState([]);
  const [estimateScope, setEstimateScope] = useState({ projectId: '', runId: '', cycleId: '' });

  // Phase 2-4 additions
  const [newSuite, setNewSuite] = useState({ projectId: '', name: '', parentId: '', description: '' });
  const [newMilestone, setNewMilestone] = useState({ projectId: '', name: '', description: '', status: 'Open', dueDate: '' });
  const [newPlan, setNewPlan] = useState({ projectId: '', name: '', description: '', status: 'Draft', milestoneId: '' });
  const [newDefect, setNewDefect] = useState({ projectId: '', title: '', description: '', severity: 'Major', priority: 'Medium', linkedTestCaseId: '', environment: 'SIT', stepsToReproduce: '' });
  const [showDefectForm, setShowDefectForm] = useState(false);
  const [editing, setEditing] = useState(null);           // { entity, id, draft }
  const [selectedCase, setSelectedCase] = useState(null); // test case detail panel
  const [caseDetail, setCaseDetail] = useState({ steps: [], versions: [], attachments: [] });
  const [bulkSelection, setBulkSelection] = useState([]);
  const [bulkPatch, setBulkPatch] = useState({ field: '', value: '' });
  const [activeRun, setActiveRun] = useState(null);
  const [runResults, setRunResults] = useState([]);
  const [reportExtra, setReportExtra] = useState({ coverage: null, trend: null, traceability: null });
  const [activity, setActivity] = useState([]);

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
      const headers = getAuthHeaders(token);
      const build = (path) => axios.get(`${API_URL}${path}`, { headers });

      const [overviewRes, projectRes, userRes, requirementRes, cycleRes, executionRes, defectRes, adminRes, testCaseRes, testRunRes, advancedRes, estimateRes, docRes, suiteRes, milestoneRes, planRes, tagRes, traceRes, coverageRes, trendRes, activityRes] = await Promise.all([
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
        build('/suites').catch(() => ({ data: { suites: [] } })),
        build('/milestones').catch(() => ({ data: { milestones: [] } })),
        build('/test-plans').catch(() => ({ data: { plans: [] } })),
        build('/tags').catch(() => ({ data: { tags: [] } })),
        build('/traceability').catch(() => ({ data: { traceability: [], uncoveredCases: [], summary: {} } })),
        build('/reports/coverage').catch(() => ({ data: { bySuite: [], byMilestone: [], byModule: [] } })),
        build('/reports/trend').catch(() => ({ data: { runsTrend: [], executionTrend: [] } })),
        build('/activity?limit=60').catch(() => ({ data: { activity: [] } })),
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
        suites: suiteRes.data.suites || [],
        milestones: milestoneRes.data.milestones || [],
        plans: planRes.data.plans || [],
        tags: tagRes.data.tags || [],
        tipeTestOptions: testCaseRes.data.tipeTestOptions || ov.advancedConfig?.tipeTestOptions || tipeTestDefaults,
        userRoleOptions: testCaseRes.data.userRoleOptions || ov.advancedConfig?.userRoleOptions || userRoleDefaults,
      }));
      setReportExtra({
        traceability: traceRes.data,
        coverage: coverageRes.data,
        trend: trendRes.data,
      });
      setActivity(activityRes.data.activity || []);
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
        suites: [], milestones: [], plans: [], sharedSteps: [], tags: [],
        tipeTestOptions: tipeTestDefaults, userRoleOptions: userRoleDefaults, searchTerm: '',
      });
      return;
    }
    loadDashboard();
  }, [token]);

  const statusSummary = useMemo(() => {
    const summaryMap = Object.fromEntries((data.overview?.byStatus || []).map((item) => [item.status, item.count]));
    return [
      { label: 'Passed', count: summaryMap.Passed || 0, color: '#059669' },
      { label: 'Failed', count: summaryMap.Failed || 0, color: '#e30613' },
      { label: 'Retest', count: summaryMap.Retest || 0, color: '#d97706' },
      { label: 'TBC', count: summaryMap.TBC || 0, color: '#1e3a5f' },
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

  /* ---------- Phase 1-4: generic edit / delete + collaboration handlers ---------- */

  const notify = (message) => { setError(''); setInfo(message); };

  const startEdit = (entity, item) => setEditing({ entity, id: item.id, draft: { ...item } });
  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    const { entity, id, draft } = editing;
    try {
      await axios.put(`${API_URL}/${entity}/${id}`, draft, { headers: getAuthHeaders(token) });
      setEditing(null);
      notify('Record updated.');
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not update record.'); }
  };

  const deleteEntity = async (entity, id, label) => {
    if (!window.confirm(`Delete ${label || 'this record'}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/${entity}/${id}`, { headers: getAuthHeaders(token) });
      notify('Record deleted.');
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not delete record.'); }
  };

  const createSuite = async () => {
    if (!newSuite.projectId || !newSuite.name) { setError('Project and suite name are required.'); return; }
    try {
      await axios.post(`${API_URL}/suites`, newSuite, { headers: getAuthHeaders(token) });
      setNewSuite({ projectId: '', name: '', parentId: '', description: '' });
      notify('Test suite created.');
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not create suite.'); }
  };

  const createMilestone = async () => {
    if (!newMilestone.projectId || !newMilestone.name) { setError('Project and milestone name are required.'); return; }
    try {
      await axios.post(`${API_URL}/milestones`, newMilestone, { headers: getAuthHeaders(token) });
      setNewMilestone({ projectId: '', name: '', description: '', status: 'Open', dueDate: '' });
      notify('Milestone created.');
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not create milestone.'); }
  };

  const createPlan = async () => {
    if (!newPlan.projectId || !newPlan.name) { setError('Project and plan name are required.'); return; }
    try {
      await axios.post(`${API_URL}/test-plans`, newPlan, { headers: getAuthHeaders(token) });
      setNewPlan({ projectId: '', name: '', description: '', status: 'Draft', milestoneId: '' });
      notify('Test plan created.');
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not create test plan.'); }
  };

  const createDefect = async () => {
    if (!canCreateDefects) { setError('Only QA Lead / QA Engineer can raise defects.'); return; }
    if (!newDefect.projectId || !newDefect.title) { setError('Project and defect title are required.'); return; }
    try {
      await axios.post(`${API_URL}/defects`, newDefect, { headers: getAuthHeaders(token) });
      setNewDefect({ projectId: '', title: '', description: '', severity: 'Major', priority: 'Medium', linkedTestCaseId: '', environment: 'SIT', stepsToReproduce: '' });
      setShowDefectForm(false);
      notify('Defect created.');
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not create defect.'); }
  };

  const createDefectFromExecution = async (executionId) => {
    try {
      await axios.post(`${API_URL}/executions/${executionId}/create-defect`, {}, { headers: getAuthHeaders(token) });
      notify('Defect raised from failed execution.');
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not create defect from execution.'); }
  };

  const updateExecution = async (id, patch) => {
    try {
      await axios.patch(`${API_URL}/executions/${id}`, patch, { headers: getAuthHeaders(token) });
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not update execution.'); }
  };

  const openCaseDetail = async (testCase) => {
    setSelectedCase(testCase);
    setCaseDetail({ steps: [], versions: [], attachments: [] });
    try {
      const headers = getAuthHeaders(token);
      const [stepsRes, versionsRes, attachRes] = await Promise.all([
        axios.get(`${API_URL}/test-cases/${testCase.id}/steps`, { headers }),
        axios.get(`${API_URL}/test-cases/${testCase.id}/versions`, { headers }),
        axios.get(`${API_URL}/attachments?entityType=test_case&entityId=${testCase.id}`, { headers }),
      ]);
      setCaseDetail({
        steps: stepsRes.data.steps || [],
        versions: versionsRes.data.versions || [],
        attachments: attachRes.data.attachments || [],
      });
    } catch (err) { setError(err.response?.data?.message || 'Could not load test case details.'); }
  };

  const refreshCaseDetail = async (id) => {
    try {
      const headers = getAuthHeaders(token);
      const [stepsRes, versionsRes, attachRes] = await Promise.all([
        axios.get(`${API_URL}/test-cases/${id}/steps`, { headers }),
        axios.get(`${API_URL}/test-cases/${id}/versions`, { headers }),
        axios.get(`${API_URL}/attachments?entityType=test_case&entityId=${id}`, { headers }),
      ]);
      setCaseDetail({
        steps: stepsRes.data.steps || [],
        versions: versionsRes.data.versions || [],
        attachments: attachRes.data.attachments || [],
      });
    } catch (err) { setError(err.response?.data?.message || 'Could not refresh detail.'); }
  };

  const saveCaseSteps = async (steps) => {
    if (!selectedCase) return;
    try {
      await axios.put(`${API_URL}/test-cases/${selectedCase.id}/steps`, { steps }, { headers: getAuthHeaders(token) });
      notify('Steps saved.');
      await refreshCaseDetail(selectedCase.id);
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not save steps.'); }
  };

  const cloneTestCase = async (id) => {
    try {
      await axios.post(`${API_URL}/test-cases/${id}/clone`, {}, { headers: getAuthHeaders(token) });
      notify('Test case cloned.');
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not clone test case.'); }
  };

  const reviewTestCase = async (id, reviewStatus) => {
    try {
      await axios.post(`${API_URL}/test-cases/${id}/review`, { reviewStatus }, { headers: getAuthHeaders(token) });
      notify(`Review status: ${reviewStatus}`);
      if (selectedCase && selectedCase.id === id) await refreshCaseDetail(id);
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not update review status.'); }
  };

  const uploadAttachment = async (file) => {
    if (!selectedCase || !file) return;
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('entityType', 'test_case');
      form.append('entityId', String(selectedCase.id));
      await axios.post(`${API_URL}/attachments`, form, {
        headers: { ...getAuthHeaders(token), 'Content-Type': 'multipart/form-data' },
      });
      notify('Attachment uploaded.');
      await refreshCaseDetail(selectedCase.id);
    } catch (err) { setError(err.response?.data?.message || 'Could not upload attachment.'); }
  };

  const deleteAttachment = async (id) => {
    try {
      await axios.delete(`${API_URL}/attachments/${id}`, { headers: getAuthHeaders(token) });
      if (selectedCase) await refreshCaseDetail(selectedCase.id);
    } catch (err) { setError(err.response?.data?.message || 'Could not delete attachment.'); }
  };

  const applyBulkEdit = async () => {
    if (!bulkSelection.length) { setError('Select at least one test case.'); return; }
    if (!bulkPatch.field || bulkPatch.value === '') { setError('Choose a field and value for bulk edit.'); return; }
    const patch = {
      status: 'status', severity: 'severity', priority: 'priority', assigneeId: 'assigneeId',
      tipeTest: 'tipeTest', statusSIT: 'statusSIT', suiteId: 'suiteId', milestoneId: 'milestoneId',
      reviewStatus: 'reviewStatus', picQA: 'picQA',
    }[bulkPatch.field];
    try {
      await axios.patch(`${API_URL}/test-cases/bulk`, { ids: bulkSelection, patch: { [patch]: bulkPatch.value } }, { headers: getAuthHeaders(token) });
      notify(`Bulk updated ${bulkSelection.length} test case(s).`);
      setBulkSelection([]); setBulkPatch({ field: '', value: '' });
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Bulk edit failed.'); }
  };

  const toggleBulkSelection = (id) => {
    setBulkSelection((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const openRun = async (run) => {
    setActiveRun(run);
    try {
      const res = await axios.get(`${API_URL}/test-runs/${run.id}/results`, { headers: getAuthHeaders(token) });
      setRunResults(res.data.results || []);
    } catch (err) { setError(err.response?.data?.message || 'Could not load run results.'); }
  };

  const updateRunResult = async (resultId, patch) => {
    if (!activeRun) return;
    try {
      await axios.patch(`${API_URL}/test-runs/${activeRun.id}/results/${resultId}`, patch, { headers: getAuthHeaders(token) });
      await openRun(activeRun);
      await loadDashboard();
    } catch (err) { setError(err.response?.data?.message || 'Could not update result.'); }
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
        latestMarkdownContent: res.data.markdownContent || '',
        latestDoc: res.data.document,
        docUploads: [res.data.document, ...(d.docUploads || [])],
      }));
      setInfo(`PDF converted to .md! Extracted ${res.data.ragChunkCount} text chunks and ${(res.data.userStories || []).length} user stories for full test coverage.`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to process PDF.');
    } finally {
      setPdfUpload((p) => ({ ...p, uploading: false }));
    }
  };

  const downloadMarkdownDoc = async (docId, fileName) => {
    try {
      const targetId = docId || data.latestDoc?.id;
      if (!targetId && data.latestMarkdownContent) {
        const blob = new Blob([data.latestMarkdownContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(fileName || 'requirement').replace(/\.[^/.]+$/, '')}.md`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      if (!targetId) { setError('No markdown document selected.'); return; }
      const res = await axios.get(`${API_URL}/requirement-documents/${targetId}/download-md`, {
        headers: getAuthHeaders(token),
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(fileName || 'requirement').replace(/\.[^/.]+$/, '')}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Unable to download Markdown file.');
    }
  };

  const downloadPdfDoc = async (docId, fileName) => {
    try {
      const res = await axios.get(`${API_URL}/requirement-documents/${docId}/download-pdf`, {
        headers: getAuthHeaders(token),
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Unable to download PDF file.');
    }
  };

  const generateScenarios = async (forceFullCoverage = true) => {
    if (!canGenerateScenarios) { setError('Permission denied.'); return; }
    try {
      setInfo('Analyzing requirement & generating full-coverage test scenarios...');
      const body = { ...scenarioGen, fullCoverage: forceFullCoverage };
      if (data.latestDoc?.id && !body.documentId) body.documentId = data.latestDoc.id;
      if (data.userStoriesFromPDF?.length && !body.projectId && !body.requirementId) {
        body.userStories = data.userStoriesFromPDF;
      }
      const res = await axios.post(`${API_URL}/test-scenarios/generate`, body, { headers: getAuthHeaders(token) });
      setData((d) => ({ ...d, generatedScenarios: res.data.scenarios || [], userStoriesFromPDF: res.data.userStories || d.userStoriesFromPDF }));
      setSelectedScenarios([]);
      setInfo(`Generated ${res.data.scenarioCount} full-coverage test scenarios covering ${res.data.storyCount} user stories!`);
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
      doc.text('BINA QA TCMS QA Report', 40, 60);
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
        <h4>Upload Requirement PDF (.md Conversion & Full Coverage Analysis)</h4>
        <div className="form-grid two-columns">
          <select value={pdfUpload.projectId} onChange={(e) => setPdfUpload({ ...pdfUpload, projectId: e.target.value })}>
            <option value="">Project for PDF (optional)</option>
            {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="file-button secondary-button">
            {pdfUpload.uploading ? 'Processing & Converting to .md...' : 'Upload PDF Requirement'}
            <input type="file" accept=".pdf" disabled={pdfUpload.uploading || !canUploadRequirements} onChange={uploadRequirementPDF} />
          </label>
        </div>
        <small style={{ color: 'var(--muted)' }}>
          Upload a PDF requirement document. The system will extract text, convert it to a structured <strong>.md (Markdown)</strong> file, extract user stories, and perform full test scenario coverage analysis.
        </small>
      </div>

      {(data.latestMarkdownContent || data.latestDoc) && (
        <div className="md-preview-card">
          <div className="md-preview-header">
            <div>
              <h4 style={{ margin: 0 }}>📄 Converted Markdown (.md) Requirement</h4>
              <small style={{ color: 'var(--muted)' }}>
                File: {data.latestDoc?.file_name || 'Requirement Document'} | Identified User Stories: {data.userStoriesFromPDF?.length || 0}
              </small>
            </div>
            <div className="inline-actions" style={{ gap: '8px' }}>
              <button className="secondary-button small doc-action-btn" onClick={() => downloadMarkdownDoc(data.latestDoc?.id, data.latestDoc?.file_name)}>
                📥 Download Converted .md File
              </button>
              <button className="primary-button small doc-action-btn" onClick={() => generateScenarios(true)}>
                🔍 Analyze Requirement & Generate Full-Coverage Scenarios
              </button>
              <button className="secondary-button small" onClick={() => setShowMdPreview(!showMdPreview)}>
                {showMdPreview ? 'Hide .md Preview' : 'Show .md Preview'}
              </button>
            </div>
          </div>

          {showMdPreview && (
            <div className="md-preview-box">
              {data.latestMarkdownContent || data.latestDoc?.markdown_content || 'Markdown content available.'}
            </div>
          )}
        </div>
      )}

      {data.userStoriesFromPDF?.length > 0 && (
        <div className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <h4>User Stories Extracted from Requirement ({data.userStoriesFromPDF.length})</h4>
            <span>Targeting 100% Full Test Coverage</span>
          </div>
          <div className="stories-grid">
            {data.userStoriesFromPDF.map((story, idx) => (
              <div key={idx} className="story-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '6px' }}>
                  <strong>{story.id || `US-${String(idx + 1).padStart(3, '0')}`}</strong>
                  <span className={`chip ${story.priority === 'High' ? 'red' : story.priority === 'Medium' ? 'amber' : 'gray'}`}>{story.priority || 'Medium'}</span>
                </div>
                <div style={{ fontSize: '0.88rem', marginBottom: '8px' }}>{(story.title || story.description || '').slice(0, 200)}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  <span className="coverage-chip pos">✓ Positive</span>
                  <span className="coverage-chip neg">✓ Negative</span>
                  <span className="coverage-chip bound">✓ Boundary</span>
                  <span className="coverage-chip ui">✓ UI/UX</span>
                  <span className="coverage-chip api">✓ API</span>
                  <span className="coverage-chip sec">✓ Security</span>
                </div>
              </div>
            ))}
          </div>
          <div className="button-row" style={{ marginTop: '12px' }}>
            <button className="primary-button small" onClick={() => generateScenarios(true)}>🚀 Generate Full-Coverage Test Scenarios</button>
            <button className="secondary-button small" onClick={() => setData((d) => ({ ...d, userStoriesFromPDF: [], latestMarkdownContent: null, latestDoc: null }))}>Clear Extracted Stories</button>
          </div>
        </div>
      )}

      {data.generatedScenarios?.length > 0 && (
        <div className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header with-actions">
            <h4>Generated Test Scenarios for Full Coverage ({data.generatedScenarios.length})</h4>
            <div className="inline-actions">
              <button
                className="secondary-button small"
                onClick={() => {
                  if (selectedScenarios.length === data.generatedScenarios.length) setSelectedScenarios([]);
                  else setSelectedScenarios(data.generatedScenarios.map((_, i) => i));
                }}
              >
                {selectedScenarios.length === data.generatedScenarios.length ? 'Deselect All' : 'Select All'}
              </button>
              <button className="primary-button small" onClick={saveGeneratedScenarios}>
                💾 Save Selected to Test Cases ({selectedScenarios.length || data.generatedScenarios.length})
              </button>
            </div>
          </div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Title / Module</th>
                  <th>User Story Coverage</th>
                  <th>Severity</th>
                  <th>Expected Result</th>
                </tr>
              </thead>
              <tbody>
                {data.generatedScenarios.map((sc, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedScenarios.includes(idx)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedScenarios([...selectedScenarios, idx]);
                          else setSelectedScenarios(selectedScenarios.filter((i) => i !== idx));
                        }}
                      />
                    </td>
                    <td><strong>{sc.code}</strong></td>
                    <td><span className="chip blue">{sc.tipe_test || 'Functional'}</span></td>
                    <td>{sc.title}</td>
                    <td><span className="chip gray">{sc.user_story_coverage}</span></td>
                    <td><span className={`chip ${sc.severity === 'Critical' ? 'red' : sc.severity === 'Major' ? 'amber' : 'gray'}`}>{sc.severity}</span></td>
                    <td><small>{(sc.hasil_yang_diharapkan || sc.expected_result || '').slice(0, 120)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.docUploads?.length > 0 && (
        <div className="panel" style={{ marginTop: '18px' }}>
          <div className="panel-header">
            <h4>Uploaded Requirement Documents ({data.docUploads.length})</h4>
          </div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Project</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.docUploads.map((doc) => (
                  <tr key={doc.id}>
                    <td><strong>📄 {doc.file_name}</strong></td>
                    <td>{doc.project_name || '-'}</td>
                    <td>{doc.uploaded_by_name || 'QA Team'}</td>
                    <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="inline-actions" style={{ gap: '6px' }}>
                        <button className="secondary-button small" onClick={() => downloadMarkdownDoc(doc.id, doc.file_name)}>
                          📥 Download .md
                        </button>
                        <button className="secondary-button small" onClick={() => downloadPdfDoc(doc.id, doc.file_name)}>
                          📥 Download PDF
                        </button>
                        <button className="primary-button small" onClick={() => {
                          setScenarioGen((s) => ({ ...s, documentId: doc.id }));
                          if (doc.user_story_breakdown) {
                            try {
                              const stories = JSON.parse(doc.user_story_breakdown);
                              setData((d) => ({ ...d, userStoriesFromPDF: stories, latestDoc: doc, latestMarkdownContent: doc.markdown_content || '' }));
                            } catch {}
                          }
                          generateScenarios(true);
                        }}>
                          🔍 Analyze & Generate Scenarios
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="scroll-x" style={{ marginTop: '18px' }}>
        <h4 style={{ margin: '0 0 10px' }}>Requirements Repository</h4>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Project</th>
              <th>Priority</th>
              <th>Source</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data.requirements || []).map((item) => (
              <tr key={item.id}>
                {editing && editing.entity === 'requirements' && editing.id === item.id ? (
                  <>
                    <td><input type="text" value={editing.draft.title || ''} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, title: e.target.value } })} /></td>
                    <td>
                      <select value={editing.draft.projectId || editing.draft.project_id || ''} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, projectId: e.target.value } })}>
                        <option value="">-</option>
                        {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={editing.draft.priority || 'Medium'} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, priority: e.target.value } })}>
                        {testCasePriorities.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td><input type="text" value={editing.draft.source || ''} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, source: e.target.value } })} /></td>
                    <td><input type="text" value={editing.draft.status || ''} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, status: e.target.value } })} /></td>
                    <td className="row-actions">
                      <button className="primary-button small" onClick={saveEdit}>Save</button>
                      <button className="ghost-button small" onClick={cancelEdit}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{item.title}</td>
                    <td>{item.project_name}</td>
                    <td>{item.priority}</td>
                    <td>{item.source}</td>
                    <td><span className="status-badge status-pass">{item.status}</span></td>
                    <td className="row-actions">
                      {canWriteTC && <button className="secondary-button small" onClick={() => startEdit('requirements', { ...item, projectId: item.project_id })}>Edit</button>}
                      {canWriteTC && <button className="ghost-button small danger" onClick={() => deleteEntity('requirements', item.id, `requirement "${item.title}"`)}>Delete</button>}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCaseDetail = () => {
    if (!selectedCase) return null;
    const steps = caseDetail.steps || [];
    const updateStep = (idx, patch) => {
      const next = steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      setCaseDetail({ ...caseDetail, steps: next });
    };
    return (
      <div className="panel" style={{ marginTop: '16px' }}>
        <div className="panel-header with-actions">
          <div>
            <h4>Test Case Detail — {selectedCase.code}</h4>
            <small>
              {selectedCase.title} • Review: <strong>{selectedCase.review_status || 'Draft'}</strong> • Version v{selectedCase.version_no || 1}
            </small>
          </div>
          <div className="inline-actions">
            {canWriteTC && <button className="secondary-button small" onClick={() => cloneTestCase(selectedCase.id)}>Clone</button>}
            <button className="ghost-button small" onClick={() => { setSelectedCase(null); setCaseDetail({ steps: [], versions: [], attachments: [] }); }}>Close</button>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <label className="field-label">Preconditions</label>
            <div className="detail-value">{selectedCase.preconditions || '-'}</div>
            <label className="field-label">Langkah Uji (legacy)</label>
            <div className="detail-value">{selectedCase.langkah_uji || selectedCase.steps || '-'}</div>
            <label className="field-label">Hasil Yang Diharapkan</label>
            <div className="detail-value">{selectedCase.hasil_yang_diharapkan || selectedCase.expected_result || '-'}</div>
          </div>

          <div>
            <label className="field-label">Review / Approval</label>
            {canWriteTC ? (
              <div className="row-actions" style={{ flexWrap: 'wrap', gap: '6px' }}>
                {reviewStatuses.map((rs) => (
                  <button
                    key={rs}
                    className={`small ${selectedCase.review_status === rs ? 'primary-button' : 'secondary-button'}`}
                    onClick={() => reviewTestCase(selectedCase.id, rs)}
                  >
                    {rs}
                  </button>
                ))}
              </div>
            ) : (
              <div className="detail-value">{selectedCase.review_status || 'Draft'}</div>
            )}

            <label className="field-label">Version History ({caseDetail.versions.length})</label>
            <div className="version-list">
              {caseDetail.versions.length === 0 && <small style={{ color: 'var(--muted)' }}>No version snapshots yet.</small>}
              {caseDetail.versions.map((v) => (
                <div key={v.id} className="version-item">
                  <span className="chip blue">v{v.version_no}</span>
                  <span>{v.review_status}</span>
                  <small>{new Date(v.created_at).toLocaleString()}</small>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: '12px' }}>
          <div className="panel-header with-actions">
            <h4>Structured Steps ({steps.length})</h4>
            <div className="inline-actions">
              {canWriteTC && (
                <button className="secondary-button small" onClick={() => setCaseDetail({ ...caseDetail, steps: [...steps, { step_no: steps.length + 1, action: '', expected: '', data: '' }] })}>
                  Add Step
                </button>
              )}
              {canWriteTC && <button className="primary-button small" onClick={() => saveCaseSteps(steps)}>Save Steps</button>}
            </div>
          </div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr><th>#</th><th>Action</th><th>Test Data</th><th>Expected Result</th>{canWriteTC && <th></th>}</tr>
              </thead>
              <tbody>
                {steps.map((s, idx) => (
                  <tr key={s.id || idx}>
                    <td>{s.step_no || idx + 1}</td>
                    <td>{canWriteTC ? <textarea rows="2" value={s.action || ''} onChange={(e) => updateStep(idx, { action: e.target.value })} /> : (s.action || '-')}</td>
                    <td>{canWriteTC ? <textarea rows="2" value={s.data || ''} onChange={(e) => updateStep(idx, { data: e.target.value })} /> : (s.data || '-')}</td>
                    <td>{canWriteTC ? <textarea rows="2" value={s.expected || ''} onChange={(e) => updateStep(idx, { expected: e.target.value })} /> : (s.expected || '-')}</td>
                    {canWriteTC && (
                      <td><button className="ghost-button small danger" onClick={() => setCaseDetail({ ...caseDetail, steps: steps.filter((_, i) => i !== idx) })}>Remove</button></td>
                    )}
                  </tr>
                ))}
                {steps.length === 0 && <tr><td colSpan={canWriteTC ? 5 : 4}><small style={{ color: 'var(--muted)' }}>No structured steps. Add a step to begin.</small></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel" style={{ marginTop: '12px' }}>
          <div className="panel-header with-actions">
            <h4>Attachments & Evidence ({caseDetail.attachments.length})</h4>
            {canWriteTC && (
              <label className="secondary-button small file-button">
                Upload File
                <input type="file" onChange={(e) => { uploadAttachment(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
          </div>
          <div className="attachment-list">
            {caseDetail.attachments.length === 0 && <small style={{ color: 'var(--muted)' }}>No attachments.</small>}
            {caseDetail.attachments.map((a) => (
              <div key={a.id} className="attachment-item">
                <a href={`${API_URL}/attachments/${a.id}/download`} target="_blank" rel="noreferrer">{a.file_name}</a>
                <small>{Math.round((a.file_size || 0) / 1024)} KB</small>
                {canWriteTC && <button className="ghost-button small danger" onClick={() => deleteAttachment(a.id)}>Delete</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

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
              <div key={idx} className="scenario-card" style={{ border: selectedScenarios.includes(idx) ? '2px solid #e30613' : undefined }}>
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

      <div className="bulk-toolbar">
        <div>
          <strong>{bulkSelection.length}</strong> selected
        </div>
        <select value={bulkPatch.field} onChange={(e) => setBulkPatch({ ...bulkPatch, field: e.target.value })}>
          <option value="">Bulk field...</option>
          <option value="status">Status TC</option>
          <option value="reviewStatus">Review Status</option>
          <option value="severity">Severity</option>
          <option value="priority">Priority</option>
          <option value="tipeTest">Tipe Test</option>
          <option value="statusSIT">Status SIT</option>
          <option value="picQA">PIC QA</option>
          <option value="suiteId">Suite ID</option>
          <option value="milestoneId">Milestone ID</option>
        </select>
        <input type="text" placeholder="New value" value={bulkPatch.value} onChange={(e) => setBulkPatch({ ...bulkPatch, value: e.target.value })} />
        <button className="primary-button small" disabled={!canWriteTC} onClick={applyBulkEdit}>Apply Bulk Edit</button>
        <button className="ghost-button small" onClick={() => setBulkSelection([])}>Clear</button>
      </div>

      <div className="scroll-x" style={{ marginTop: '18px' }}>
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={filteredTestCases.length > 0 && bulkSelection.length === filteredTestCases.length}
                onChange={(e) => setBulkSelection(e.target.checked ? filteredTestCases.map((c) => c.id) : [])}
              />
            </th>
            <th>Code</th>
            <th>Title / Modul Fitur</th>
            <th>Project</th>
            <th>Tipe Test</th>
            <th>Severity</th>
            <th>Priority</th>
            <th>Status TC</th>
            <th>Review</th>
            <th>Status SIT</th>
            <th>User Story</th>
            <th>PIC QA</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredTestCases.map((item) => (
            <tr key={item.id}>
              <td>
                <input type="checkbox" checked={bulkSelection.includes(item.id)} onChange={() => toggleBulkSelection(item.id)} />
              </td>
              <td><strong>{item.code}</strong></td>
              <td>{item.title || item.modul_fitur}</td>
              <td>{item.project_name}</td>
              <td>{item.tipe_test || '-'}</td>
              <td>{item.severity}</td>
              <td>{item.priority}</td>
              <td><span className="status-badge status-pass">{item.status}</span></td>
              <td><span className={`chip ${item.review_status === 'Approved' ? 'green' : item.review_status === 'Rejected' ? 'red' : 'gray'}`}>{item.review_status || 'Draft'}</span></td>
              <td><span className={`status-badge ${item.status_sit === 'Passed' ? 'status-pass' : item.status_sit === 'Failed' ? 'status-danger' : 'status-warn'}`}>{item.status_sit || '-'}</span></td>
              <td>{item.user_story_coverage || '-'}</td>
              <td>{item.pic_qa || '-'}</td>
              <td className="row-actions">
                <button className="secondary-button small" onClick={() => openCaseDetail(item)}>Detail</button>
                {canWriteTC && <button className="secondary-button small" onClick={() => startEdit('test-cases', { ...item, projectId: item.project_id })}>Edit</button>}
                {canWriteTC && <button className="ghost-button small" onClick={() => cloneTestCase(item.id)}>Clone</button>}
                {canWriteTC && <button className="ghost-button small danger" onClick={() => deleteEntity('test-cases', item.id, `test case "${item.code}"`)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {renderCaseDetail()}
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
            <th>Actions</th>
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
              <td className="row-actions">
                {canManageCycles && <button className="secondary-button small" onClick={() => startEdit('test-cycles', { ...item, projectId: item.project_id, planId: item.plan_id })}>Edit</button>}
                {canManageCycles && <button className="ghost-button small danger" onClick={() => deleteEntity('test-cycles', item.id, `cycle "${item.name}"`)}>Delete</button>}
              </td>
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
            <th>Actions</th>
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
              <td className="row-actions">
                <button className="secondary-button small" onClick={() => openRun(item)}>View Results</button>
                {(canManageCycles || canWriteTC) && <button className="secondary-button small" onClick={() => startEdit('test-runs', { ...item, projectId: item.project_id, cycleId: item.cycle_id })}>Edit</button>}
                {(canManageCycles || canWriteTC) && <button className="ghost-button small danger" onClick={() => deleteEntity('test-runs', item.id, `test run "${item.name}"`)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {activeRun && (
        <div className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header with-actions">
            <div>
              <h4>Run Results — {activeRun.name}</h4>
              <small>{runResults.length} result(s)</small>
            </div>
            <button className="ghost-button small" onClick={() => { setActiveRun(null); setRunResults([]); }}>Close</button>
          </div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr><th>Code</th><th>Title</th><th>Assignee</th><th>Status</th><th>Elapsed (min)</th><th>Environment</th><th>Notes</th><th>Evidence</th></tr>
              </thead>
              <tbody>
                {runResults.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.code}</strong></td>
                    <td>{r.title}</td>
                    <td>{r.assignee_name || '-'}</td>
                    <td>
                      <select value={r.status} onChange={(e) => updateRunResult(r.id, { status: e.target.value })}>
                        {runResultStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><input type="number" min="0" style={{ width: '80px' }} defaultValue={r.elapsed_minutes || 0} onBlur={(e) => updateRunResult(r.id, { elapsedMinutes: Number(e.target.value) })} /></td>
                    <td><input type="text" defaultValue={r.environment || ''} onBlur={(e) => updateRunResult(r.id, { environment: e.target.value })} /></td>
                    <td><input type="text" defaultValue={r.notes || ''} onBlur={(e) => updateRunResult(r.id, { notes: e.target.value })} /></td>
                    <td>{r.evidenceUrl ? <a href={r.evidenceUrl} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                  </tr>
                ))}
                {runResults.length === 0 && <tr><td colSpan="8"><small style={{ color: 'var(--muted)' }}>No results recorded for this run.</small></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
                <select value={item.status} onChange={(e) => updateExecution(item.id, { status: e.target.value })}>
                  {executionStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <textarea
                  rows="2"
                  placeholder="Execution notes..."
                  defaultValue={item.notes || ''}
                  onBlur={(e) => { if (e.target.value !== (item.notes || '')) updateExecution(item.id, { notes: e.target.value }); }}
                />
                {item.status === 'Failed' && canCreateDefects && (
                  <button className="ghost-button small danger" onClick={() => createDefectFromExecution(item.id)}>Create Defect</button>
                )}
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
          {canCreateDefects && (
            <button className="primary-button small" onClick={() => setShowDefectForm(!showDefectForm)}>
              {showDefectForm ? 'Hide Form' : 'New Defect'}
            </button>
          )}
          <button className="primary-button small" onClick={() => exportCsv(data.defects, 'defects.csv')}>Export CSV</button>
          <button className="secondary-button small" onClick={() => exportXlsx(data.defects, 'defects.xlsx')}>Export XLSX</button>
        </div>
      </div>

      {showDefectForm && canCreateDefects && (
        <div className="form-grid two-columns">
          <select value={newDefect.projectId} onChange={(e) => setNewDefect({ ...newDefect, projectId: e.target.value })}>
            <option value="">Select project</option>
            {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="text" placeholder="Defect title" value={newDefect.title} onChange={(e) => setNewDefect({ ...newDefect, title: e.target.value })} />
          <select value={newDefect.severity} onChange={(e) => setNewDefect({ ...newDefect, severity: e.target.value })}>
            {testCaseSeverities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={newDefect.priority} onChange={(e) => setNewDefect({ ...newDefect, priority: e.target.value })}>
            {testCasePriorities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={newDefect.linkedTestCaseId} onChange={(e) => setNewDefect({ ...newDefect, linkedTestCaseId: e.target.value })}>
            <option value="">Linked Test Case (optional)</option>
            {(data.testCases || []).map((tc) => <option key={tc.id} value={tc.id}>{tc.code} - {tc.title?.slice(0, 40)}</option>)}
          </select>
          <input type="text" placeholder="Environment (e.g. SIT)" value={newDefect.environment} onChange={(e) => setNewDefect({ ...newDefect, environment: e.target.value })} />
          <textarea className="full-width" rows="3" placeholder="Description" value={newDefect.description} onChange={(e) => setNewDefect({ ...newDefect, description: e.target.value })} />
          <textarea className="full-width" rows="3" placeholder="Steps to reproduce" value={newDefect.stepsToReproduce} onChange={(e) => setNewDefect({ ...newDefect, stepsToReproduce: e.target.value })} />
          <div className="button-row">
            <button className="primary-button" onClick={createDefect}>Create Defect</button>
            <button className="secondary-button" onClick={() => setShowDefectForm(false)}>Cancel</button>
          </div>
        </div>
      )}

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
            <th>Actions</th>
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
              <td className="row-actions">
                {canCreateDefects && <button className="secondary-button small" onClick={() => startEdit('defects', { ...item, projectId: item.project_id, linkedTestCaseId: item.linked_test_case_id })}>Edit</button>}
                {canCreateDefects && <button className="ghost-button small danger" onClick={() => deleteEntity('defects', item.id, `defect "${item.title}"`)}>Delete</button>}
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
          {['summary', 'distribution', 'traceability', 'coverage', 'trend', 'estimate'].map((t) => (
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

        {reportTab === 'coverage' && (
          <>
            <div className="two-column-grid">
              <div className="panel">
                <div className="panel-header"><h4>Coverage by Test Suite</h4></div>
                <div className="scroll-x">
                  <table>
                    <thead><tr><th>Suite</th><th>Total</th><th>Approved</th><th>Passed</th><th>Failed</th><th>Coverage</th></tr></thead>
                    <tbody>
                      {(reportExtra.coverage?.bySuite || []).map((s) => (
                        <tr key={s.suite_id ?? s.suite_name}>
                          <td>{s.suite_name}</td>
                          <td>{s.total}</td>
                          <td>{s.approved}</td>
                          <td>{s.passed}</td>
                          <td>{s.failed}</td>
                          <td>{s.total ? Math.round((s.passed / s.total) * 100) : 0}%</td>
                        </tr>
                      ))}
                      {(reportExtra.coverage?.bySuite || []).length === 0 && <tr><td colSpan="6"><small style={{ color: 'var(--muted)' }}>No suite coverage data.</small></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><h4>Coverage by Milestone</h4></div>
                <div className="scroll-x">
                  <table>
                    <thead><tr><th>Milestone</th><th>Due</th><th>Total</th><th>Passed</th><th>Failed</th></tr></thead>
                    <tbody>
                      {(reportExtra.coverage?.byMilestone || []).map((m) => (
                        <tr key={m.milestone_name}>
                          <td>{m.milestone_name}</td>
                          <td>{m.due_date ? new Date(m.due_date).toLocaleDateString() : '-'}</td>
                          <td>{m.total}</td>
                          <td><span className="chip green">{m.passed}</span></td>
                          <td><span className="chip red">{m.failed}</span></td>
                        </tr>
                      ))}
                      {(reportExtra.coverage?.byMilestone || []).length === 0 && <tr><td colSpan="5"><small style={{ color: 'var(--muted)' }}>No milestone coverage data.</small></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginTop: '12px' }}>
              <div className="panel-header"><h4>Coverage by Module</h4></div>
              <div className="scroll-x">
                <table>
                  <thead><tr><th>Modul &amp; Fitur</th><th>Total</th><th>Passed</th><th>Failed</th><th>Coverage</th></tr></thead>
                  <tbody>
                    {(reportExtra.coverage?.byModule || []).map((m) => {
                      const pct = m.total ? Math.round((m.passed / m.total) * 100) : 0;
                      return (
                        <tr key={m.modul_fitur}>
                          <td>{m.modul_fitur}</td>
                          <td>{m.total}</td>
                          <td>{m.passed}</td>
                          <td>{m.failed}</td>
                          <td>
                            <div className="coverage-bar">
                              <div className="coverage-bar-fill" style={{ width: `${pct}%` }} />
                              <span>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(reportExtra.coverage?.byModule || []).length === 0 && <tr><td colSpan="5"><small style={{ color: 'var(--muted)' }}>No module coverage data.</small></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {reportTab === 'trend' && (
          <div className="two-column-grid">
            <div className="panel">
              <div className="panel-header"><h4>Run Creation Trend</h4></div>
              <div className="scroll-x">
                <table>
                  <thead><tr><th>Date</th><th>Runs</th><th>Passed</th><th>Failed</th><th>Blocked/Retest</th></tr></thead>
                  <tbody>
                    {(reportExtra.trend?.runsTrend || []).map((p) => (
                      <tr key={p.day}>
                        <td>{new Date(p.day).toLocaleDateString()}</td>
                        <td>{p.runs}</td>
                        <td><span className="chip green">{p.passed}</span></td>
                        <td><span className="chip red">{p.failed}</span></td>
                        <td><span className="chip amber">{p.blocked}</span></td>
                      </tr>
                    ))}
                    {(reportExtra.trend?.runsTrend || []).length === 0 && <tr><td colSpan="5"><small style={{ color: 'var(--muted)' }}>No run trend data.</small></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><h4>Execution Trend</h4></div>
              <div className="scroll-x">
                <table>
                  <thead><tr><th>Date</th><th>Passed</th><th>Failed</th><th>Total</th><th>Pass Rate</th></tr></thead>
                  <tbody>
                    {(reportExtra.trend?.executionTrend || []).map((p) => {
                      const total = (p.passed || 0) + (p.failed || 0);
                      return (
                        <tr key={p.day}>
                          <td>{new Date(p.day).toLocaleDateString()}</td>
                          <td><span className="chip green">{p.passed}</span></td>
                          <td><span className="chip red">{p.failed}</span></td>
                          <td>{total}</td>
                          <td>{total ? Math.round((p.passed / total) * 100) : 0}%</td>
                        </tr>
                      );
                    })}
                    {(reportExtra.trend?.executionTrend || []).length === 0 && <tr><td colSpan="5"><small style={{ color: 'var(--muted)' }}>No execution trend data.</small></td></tr>}
                  </tbody>
                </table>
              </div>
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

  const renderSuites = () => (
    <div className="panel full-height-panel">
      <div className="panel-header with-actions">
        <div>
          <h3>Test Suites &amp; Folders ({(data.suites || []).length})</h3>
          <small>Group test cases into reusable suites for TestRail / Kiwi TCMS-style organisation</small>
        </div>
        <div className="inline-actions">
          <button className="secondary-button small" onClick={() => exportCsv(data.suites, 'test-suites.csv')}>Export CSV</button>
        </div>
      </div>

      {canWriteTC && (
        <>
          <div className="form-grid two-columns">
            <select value={newSuite.projectId} onChange={(e) => setNewSuite({ ...newSuite, projectId: e.target.value })}>
              <option value="">Select project *</option>
              {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="text" placeholder="Suite name *" value={newSuite.name} onChange={(e) => setNewSuite({ ...newSuite, name: e.target.value })} />
            <select value={newSuite.parentId} onChange={(e) => setNewSuite({ ...newSuite, parentId: e.target.value })}>
              <option value="">No parent (top level)</option>
              {(data.suites || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="text" placeholder="Description" value={newSuite.description} onChange={(e) => setNewSuite({ ...newSuite, description: e.target.value })} />
          </div>
          <div className="button-row">
            <button className="primary-button" onClick={createSuite}>Create Suite</button>
          </div>
        </>
      )}

      <div className="scroll-x">
        <table>
          <thead>
            <tr><th>Suite</th><th>Parent</th><th>Project</th><th>Cases</th><th>Description</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {(data.suites || []).map((item) => {
              const isEditing = editing?.entity === 'suites' && editing.id === item.id;
              return (
                <tr key={item.id}>
                  <td>
                    {isEditing
                      ? <input type="text" value={editing.draft.name} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, name: e.target.value } })} />
                      : <strong>{item.name}</strong>}
                  </td>
                  <td>{item.parent_name || '-'}</td>
                  <td>{item.project_name}</td>
                  <td><span className="chip">{item.case_count || 0}</span></td>
                  <td>
                    {isEditing
                      ? <input type="text" value={editing.draft.description || ''} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, description: e.target.value } })} />
                      : (item.description || '-')}
                  </td>
                  <td className="row-actions">
                    {isEditing ? (
                      <>
                        <button className="primary-button small" onClick={saveEdit}>Save</button>
                        <button className="ghost-button small" onClick={cancelEdit}>Cancel</button>
                      </>
                    ) : (
                      <>
                        {canWriteTC && <button className="secondary-button small" onClick={() => startEdit('suites', item)}>Edit</button>}
                        {canWriteTC && <button className="ghost-button small danger" onClick={() => deleteEntity('suites', item.id, `suite "${item.name}"`)}>Delete</button>}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {!(data.suites || []).length && <tr><td colSpan="6">No suites yet. Create one to organise your test cases.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPlans = () => (
    <>
      <div className="panel" style={{ marginBottom: '18px' }}>
        <div className="panel-header with-actions">
          <div>
            <h3>Milestones ({(data.milestones || []).length})</h3>
            <small>TestRail-style milestones to group test plans against a release target</small>
          </div>
        </div>
        {(canManageCycles || canWriteTC) && (
          <div className="form-grid two-columns">
            <select value={newMilestone.projectId} onChange={(e) => setNewMilestone({ ...newMilestone, projectId: e.target.value })}>
              <option value="">Select project *</option>
              {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="text" placeholder="Milestone name *" value={newMilestone.name} onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })} />
            <input type="date" value={newMilestone.dueDate} onChange={(e) => setNewMilestone({ ...newMilestone, dueDate: e.target.value })} />
            <select value={newMilestone.status} onChange={(e) => setNewMilestone({ ...newMilestone, status: e.target.value })}>
              {['Open', 'In Progress', 'Completed', 'Cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="full-width" type="text" placeholder="Description" value={newMilestone.description} onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })} />
          </div>
        )}
        {(canManageCycles || canWriteTC) && (
          <div className="button-row"><button className="primary-button" onClick={createMilestone}>Create Milestone</button></div>
        )}
        <div className="scroll-x">
          <table>
            <thead><tr><th>Milestone</th><th>Project</th><th>Due Date</th><th>Status</th><th>Cases</th><th>Actions</th></tr></thead>
            <tbody>
              {(data.milestones || []).map((item) => {
                const isEditing = editing?.entity === 'milestones' && editing.id === item.id;
                return (
                  <tr key={item.id}>
                    <td>{isEditing
                      ? <input type="text" value={editing.draft.name} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, name: e.target.value } })} />
                      : <strong>{item.name}</strong>}</td>
                    <td>{item.project_name}</td>
                    <td>{isEditing
                      ? <input type="date" value={(editing.draft.due_date || '').slice(0, 10)} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, due_date: e.target.value } })} />
                      : (item.due_date ? String(item.due_date).slice(0, 10) : '-')}</td>
                    <td><span className="status-badge status-pass">{item.status}</span></td>
                    <td><span className="chip">{item.case_count || 0}</span></td>
                    <td className="row-actions">
                      {isEditing ? (
                        <><button className="primary-button small" onClick={saveEdit}>Save</button><button className="ghost-button small" onClick={cancelEdit}>Cancel</button></>
                      ) : (
                        <>{canManageCycles && <button className="secondary-button small" onClick={() => startEdit('milestones', item)}>Edit</button>}
                          {canManageCycles && <button className="ghost-button small danger" onClick={() => deleteEntity('milestones', item.id, `milestone "${item.name}"`)}>Delete</button>}</>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!(data.milestones || []).length && <tr><td colSpan="6">No milestones yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel full-height-panel">
        <div className="panel-header with-actions">
          <div>
            <h3>Test Plans ({(data.plans || []).length})</h3>
            <small>Xray-style test plans linking milestones to execution cycles</small>
          </div>
          <div className="inline-actions">
            <button className="secondary-button small" onClick={() => exportCsv(data.plans, 'test-plans.csv')}>Export CSV</button>
          </div>
        </div>
        {(canManageCycles || canWriteTC) && (
          <>
            <div className="form-grid two-columns">
              <select value={newPlan.projectId} onChange={(e) => setNewPlan({ ...newPlan, projectId: e.target.value })}>
                <option value="">Select project *</option>
                {(data.projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="text" placeholder="Plan name *" value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} />
              <select value={newPlan.milestoneId} onChange={(e) => setNewPlan({ ...newPlan, milestoneId: e.target.value })}>
                <option value="">No milestone</option>
                {(data.milestones || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={newPlan.status} onChange={(e) => setNewPlan({ ...newPlan, status: e.target.value })}>
                {['Draft', 'Active', 'Completed', 'Archived'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className="full-width" type="text" placeholder="Description" value={newPlan.description} onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })} />
            </div>
            <div className="button-row"><button className="primary-button" onClick={createPlan}>Create Test Plan</button></div>
          </>
        )}
        <div className="scroll-x">
          <table>
            <thead><tr><th>Plan</th><th>Project</th><th>Milestone</th><th>Status</th><th>Cycles</th><th>Actions</th></tr></thead>
            <tbody>
              {(data.plans || []).map((item) => {
                const isEditing = editing?.entity === 'test-plans' && editing.id === item.id;
                return (
                  <tr key={item.id}>
                    <td>{isEditing
                      ? <input type="text" value={editing.draft.name} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, name: e.target.value } })} />
                      : <strong>{item.name}</strong>}</td>
                    <td>{item.project_name}</td>
                    <td>{item.milestone_name || '-'}</td>
                    <td><span className="status-badge status-pass">{item.status}</span></td>
                    <td><span className="chip">{item.cycle_count || 0}</span></td>
                    <td className="row-actions">
                      {isEditing ? (
                        <><button className="primary-button small" onClick={saveEdit}>Save</button><button className="ghost-button small" onClick={cancelEdit}>Cancel</button></>
                      ) : (
                        <>{canManageCycles && <button className="secondary-button small" onClick={() => startEdit('test-plans', item)}>Edit</button>}
                          {canManageCycles && <button className="ghost-button small danger" onClick={() => deleteEntity('test-plans', item.id, `plan "${item.name}"`)}>Delete</button>}</>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!(data.plans || []).length && <tr><td colSpan="6">No test plans yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderTraceability = () => {
    const t = reportExtra.traceability || { traceability: [], uncoveredCases: [], summary: {} };
    const rows = t.traceability || [];
    const summary = t.summary || {};
    return (
      <div className="panel full-height-panel">
        <div className="panel-header with-actions">
          <div>
            <h3>Requirement Traceability Matrix</h3>
            <small>Xray / TestLink-style coverage: requirement → test cases → execution status</small>
          </div>
          <div className="inline-actions">
            <button className="secondary-button small" onClick={() => exportCsv(rows, 'traceability.csv')}>Export CSV</button>
          </div>
        </div>

        <section className="kpi-row">
          <div className="kpi-item"><strong>{summary.totalRequirements || 0}</strong><small>Requirements</small></div>
          <div className="kpi-item"><strong>{summary.coveredRequirements || 0}</strong><small>Covered</small></div>
          <div className="kpi-item"><strong>{summary.totalCases || 0}</strong><small>Test Cases</small></div>
          <div className="kpi-item"><strong>{summary.uncoveredCases || 0}</strong><small>Uncovered Cases</small></div>
          <div className="kpi-item">
            <strong>{summary.totalRequirements ? Math.round(((summary.coveredRequirements || 0) / summary.totalRequirements) * 100) : 0}%</strong>
            <small>Requirement Coverage</small>
          </div>
        </section>

        <div className="scroll-x">
          <table>
            <thead>
              <tr><th>Requirement</th><th>Project</th><th>Priority</th><th>Status</th><th>TC Linked</th><th>Approved</th><th>Passed</th><th>Coverage</th><th>Linked Cases</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.title}</strong></td>
                  <td>{r.project_name || '-'}</td>
                  <td>{r.priority}</td>
                  <td><span className="status-badge status-pass">{r.status}</span></td>
                  <td>{r.case_count}</td>
                  <td>{r.approved_count}</td>
                  <td>{r.passed_count}</td>
                  <td><strong>{r.coverage_percent}%</strong></td>
                  <td>{(r.testCases || []).map((tc) => <span key={tc.id} className="chip">{tc.code}</span>)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="9">No requirements found.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header"><h4>Uncovered Test Cases ({(t.uncoveredCases || []).length})</h4></div>
          <div className="scroll-x">
            <table>
              <thead><tr><th>Code</th><th>Title</th><th>Module</th><th>Review</th></tr></thead>
              <tbody>
                {(t.uncoveredCases || []).map((tc) => (
                  <tr key={tc.id}>
                    <td><strong>{tc.code}</strong></td>
                    <td>{tc.title}</td>
                    <td>{tc.modul_fitur || '-'}</td>
                    <td><span className="chip">{tc.review_status || 'Draft'}</span></td>
                  </tr>
                ))}
                {!(t.uncoveredCases || []).length && <tr><td colSpan="4">Every test case is linked to a requirement.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderActivity = () => (
    <div className="panel full-height-panel">
      <div className="panel-header with-actions">
        <div>
          <h3>Activity &amp; Audit Log ({activity.length})</h3>
          <small>Chronological trace of every create / update / review / execution action</small>
        </div>
        <div className="inline-actions">
          <button className="secondary-button small" onClick={loadDashboard}>Refresh</button>
        </div>
      </div>
      <div className="activity-feed">
        {activity.map((a) => (
          <div key={a.id} className="activity-item">
            <div className="user-avatar small">{a.actor_avatar || (a.actor_name || '?').slice(0, 2).toUpperCase()}</div>
            <div className="activity-body">
              <strong>{a.actor_name || 'System'}</strong>
              <span className="chip">{a.action}</span>
              <span className="chip gray">{a.entity_type}{a.entity_id ? ` #${a.entity_id}` : ''}</span>
              <small>{a.detail}</small>
            </div>
            <small className="activity-time">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</small>
          </div>
        ))}
        {!activity.length && <div className="loading-box">No activity recorded yet.</div>}
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'requirements': return renderRequirements();
      case 'test-cases': return renderTestCases();
      case 'test-suites': return renderSuites();
      case 'test-plans': return renderPlans();
      case 'test-cycles': return renderCycles();
      case 'test-runs': return renderTestRuns();
      case 'execution-board': return renderExecutionBoard();
      case 'defects': return renderDefects();
      case 'traceability': return renderTraceability();
      case 'reports': return renderReports();
      case 'activity': return renderActivity();
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
        <div className="brand-name">BINA QA TCMS</div>
        <nav className="nav-menu">
          <span className="nav-label">Workflow</span>
          {navItems.map((item) => (
            <button key={item} type="button" className={activeTab === item ? 'nav-item active' : 'nav-item'} onClick={() => handleTabClick(item)}>
              {navLabels[item] || item.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
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
            <span className="badge" style={{ backgroundColor: roleMeta[userRole]?.color || '#0b1a33' }}>
              {roleMeta[userRole]?.label || 'User'}
            </span>
          </div>
        </header>


        {loading ? <div className="loading-box">Loading QA workspace...</div> : null}
        {error ? <div className="error-box">{error}</div> : null}
        {info ? <div className="info-box">{info}</div> : null}

        {renderActiveTab()}
      </main>
    </div>
  );
}
