/**
 * TourSystem.jsx – Iteration-based, multi-engine product tour for Bank Ina TCMS
 *
 * Content lives in ./tour/tourContent.js (10 workflow iterations + a full
 * end-to-end itinerary). Rendering is delegated to ./tour/engines.js which
 * adapts five libraries: Driver.js, Intro.js, Shepherd.js, Hopscotch and
 * Bootstrap Tour.
 *
 * This file owns everything else:
 *   • the tour hub (iteration picker, engine picker, autoplay toggle)
 *   • cross-page orchestration (navigate → wait for anchor → highlight)
 *   • the control HUD (Back / Next / Play / speed / engine switch / Exit)
 *   • "video demo" autoplay mode with a live progress bar
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TOUR_LIST, ENGINE_META, getSteps, getTour } from './tour/tourContent.js';
import { createEngine } from './tour/engines.js';

const STORAGE_ENGINE = 'tcmsTourEngine';
const STORAGE_SPEED = 'tcmsTourSpeed';

const SPEEDS = [
  { value: 1.25, label: '1.25×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
];

const ROLE_COLORS = {
  'All Roles': '#059669',
  'QA Lead (Admin)': '#0b1a33',
  'PM / QA Lead': '#e30613',
  'QA Engineer / PM': '#1e3a5f',
  'PM / QA Lead / All': '#c5a86a',
  'Business Analyst / Product': '#b91c1c',
  'QA Engineer': '#1e3a5f',
  'QA Lead / PM': '#0b1a33',
  'QA Lead / QA Engineer': '#1e3a5f',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Reading time heuristic: longer narration gets more time on screen. */
function stepDuration(step) {
  const chars = `${step.title || ''} ${step.body || ''}`.replace(/<[^>]+>/g, '').length;
  return Math.min(Math.max(3200 + chars * 28, 3800), 13000);
}

/** Resolve a selector, polling while the target page renders. */
function waitForElement(selector, timeout) {
  return new Promise((resolve) => {
    if (!selector) return resolve(null);
    const immediate = document.querySelector(selector);
    if (immediate) return resolve(immediate);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) { clearInterval(timer); resolve(el); }
      else if (Date.now() - startedAt > timeout) { clearInterval(timer); resolve(null); }
    }, 120);
  });
}

export function TourHub({ onNavigate, activeTab = 'overview', authenticated = true }) {
  /* ----------------------------- preferences ----------------------------- */
  const [hubOpen, setHubOpen] = useState(false);
  const [engineId, setEngineId] = useState(() => localStorage.getItem(STORAGE_ENGINE) || 'driver');
  const [speed, setSpeed] = useState(() => Number(localStorage.getItem(STORAGE_SPEED)) || 2);
  const [autoplay, setAutoplay] = useState(true);

  /* ------------------------------ session -------------------------------- */
  const [session, setSession] = useState(null); // { tourId, index, total, playing, speed }
  const [progress, setProgress] = useState(0);

  const engineRef = useRef(null);
  const sessionRef = useRef(null);
  const engineIdRef = useRef(engineId);
  const activeTabRef = useRef(activeTab);
  const navigateRef = useRef(onNavigate);
  const autoTimerRef = useRef(null);
  const progressTimerRef = useRef(null);

  activeTabRef.current = activeTab;
  navigateRef.current = onNavigate;
  engineIdRef.current = engineId;

  const engineMeta = useMemo(() => ENGINE_META.find((e) => e.id === engineId) || ENGINE_META[0], [engineId]);
  const activeSteps = useMemo(() => (session ? getSteps(session.tourId) : []), [session?.tourId]);
  const currentStep = session ? activeSteps[session.index] : null;

  /* ------------------------------ helpers -------------------------------- */
  const persistEngine = useCallback((id) => {
    setEngineId(id);
    localStorage.setItem(STORAGE_ENGINE, id);
  }, []);

  const persistSpeed = useCallback((value) => {
    setSpeed(value);
    localStorage.setItem(STORAGE_SPEED, String(value));
  }, []);

  const ensureEngine = useCallback(async (id) => {
    if (engineRef.current && engineRef.current.id === id) return engineRef.current;
    if (engineRef.current) {
      try { engineRef.current.destroy(); } catch { /* noop */ }
      engineRef.current = null;
    }
    const adapter = await createEngine(id);
    engineRef.current = adapter;
    return adapter;
  }, []);

  const clearTimers = useCallback(() => {
    clearTimeout(autoTimerRef.current);
    clearInterval(progressTimerRef.current);
    autoTimerRef.current = null;
    progressTimerRef.current = null;
  }, []);

  const teardown = useCallback(() => {
    clearTimers();
    if (engineRef.current) {
      try { engineRef.current.destroy(); } catch { /* noop */ }
      engineRef.current = null;
    }
  }, [clearTimers]);

  const finish = useCallback(() => {
    teardown();
    sessionRef.current = null;
    setSession(null);
    setProgress(0);
  }, [teardown]);

  /* --------------------------- step orchestration ------------------------ */
  const renderStep = useCallback(async (targetIndex) => {
    const active = sessionRef.current;
    if (!active) return;
    const steps = getSteps(active.tourId);

    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex >= steps.length) { finish(); return; }

    active.index = targetIndex;
    setSession({ ...active });

    const step = steps[targetIndex];

    /* 1. cross-page routing — hop to the module that owns this anchor */
    if (step.route && activeTabRef.current !== step.route) {
      navigateRef.current?.(step.route);
      await sleep(80);
      if (sessionRef.current !== active) return;
    }

    /* 2. wait for the anchor to mount */
    const el = step.anchor ? await waitForElement(step.anchor, step.route ? 6000 : 3000) : null;
    if (sessionRef.current !== active) return;

    /* 3. hand the (possibly centred) step to the active engine */
    const effectiveStep = el ? step : { ...step, anchor: null };
    let adapter;
    try {
      adapter = await ensureEngine(engineIdRef.current);
    } catch (error) {
      console.error('[TourSystem] engine failed to load', error);
      return;
    }
    if (sessionRef.current !== active) return;
    try {
      await adapter.show(effectiveStep);
    } catch (error) {
      console.error('[TourSystem] step render failed', error);
    }

    /* 4. autoplay scheduling + progress bar */
    clearTimers();
    if (active.playing) {
      const duration = stepDuration(step) / (active.speed || 1);
      const startedAt = Date.now();
      setProgress(0);
      progressTimerRef.current = setInterval(() => {
        const pct = Math.min(((Date.now() - startedAt) / duration) * 100, 100);
        setProgress(pct);
      }, 120);
      autoTimerRef.current = setTimeout(() => {
        const stillActive = sessionRef.current;
        if (!stillActive) return;
        renderStep(stillActive.index + 1);
      }, duration);
    } else {
      setProgress(0);
    }
  }, [clearTimers, ensureEngine, finish]);

  const next = useCallback(() => {
    const active = sessionRef.current;
    if (!active) return;
    renderStep(active.index + 1);
  }, [renderStep]);

  const prev = useCallback(() => {
    const active = sessionRef.current;
    if (!active) return;
    renderStep(active.index - 1);
  }, [renderStep]);

  const startTour = useCallback((tourId) => {
    const tour = getTour(tourId);
    if (!tour) return;
    const steps = getSteps(tourId);
    if (!steps.length) return;

    setHubOpen(false);
    teardown();

    const nextSession = { tourId, index: 0, total: steps.length, playing: autoplay, speed };
    sessionRef.current = nextSession;
    setSession({ ...nextSession });
    renderStep(0);
  }, [autoplay, renderStep, speed, teardown]);

  const togglePlay = useCallback(() => {
    const active = sessionRef.current;
    if (!active) return;
    active.playing = !active.playing;
    setSession({ ...active });
    if (active.playing) renderStep(active.index);
    else clearTimers();
  }, [clearTimers, renderStep]);

  const jumpTo = useCallback((index) => renderStep(index), [renderStep]);

  const changeEngine = useCallback(async (id) => {
    persistEngine(id);
    engineIdRef.current = id;
    if (!sessionRef.current) return;
    if (engineRef.current) {
      try { engineRef.current.destroy(); } catch { /* noop */ }
      engineRef.current = null;
    }
    await renderStep(sessionRef.current.index);
  }, [persistEngine, renderStep]);

  /* ------------------------------ lifecycle ------------------------------ */
  useEffect(() => () => { teardown(); }, [teardown]);

  useEffect(() => {
    if (!session) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') { finish(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); prev(); }
      else if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, finish, next, prev, togglePlay]);

  /* Clicking the dimmed area of driver.js keeps the tour alive; the HUD owns exit. */

  /* -------------------------------- render ------------------------------- */
  return (
    <>
      {!session && (
        <button
          type="button"
          className="tour-fab"
          id="tour-launch-btn"
          onClick={() => setHubOpen((v) => !v)}
          title="Open the guided product tour"
          aria-label="Product tour hub"
        >
          <span>🧭</span>
          <span className="tour-fab-label">Tour</span>
        </button>
      )}

      {hubOpen && !session && (
        <div
          className="tour-hub-backdrop"
          onClick={(e) => e.target === e.currentTarget && setHubOpen(false)}
        >
          <div className="tour-hub-dialog" role="dialog" aria-modal="true" aria-label="Product tour hub">
            <div className="tour-hub-header">
              <div>
                <h2 className="tour-hub-title">🧭 Guided Product Tour</h2>
                <p className="tour-hub-subtitle">
                  Bank Ina TCMS — a 10-iteration workflow from sign-in to audit report, playable through five
                  different tour engines.
                </p>
              </div>
              <button className="tour-hub-close" onClick={() => setHubOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="tour-hub-body">
              <div className="tour-hub-intro">
                <span>💡</span>
                <span>
                  Follow the iterations in order to learn the app from scratch, or press <kbd>▶ Play</kbd> to watch
                  it as an auto-advancing video demo. Switch engines at any time — the same script runs on all five.
                </span>
              </div>

              <div className="tour-options-row">
                <label className="tour-switch">
                  <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
                  <span>Video demo mode (auto-advance)</span>
                </label>
                <label className="tour-speed">
                  Speed
                  <select value={speed} onChange={(e) => persistSpeed(Number(e.target.value))}>
                    {SPEEDS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="tour-card-grid">
                {TOUR_LIST.map((tour) => {
                  const locked = tour.requiresAuth && !authenticated;
                  return (
                    <button
                      key={tour.id}
                      type="button"
                      className={`tour-card ${tour.id === 'workflow-full' ? 'tour-card-wide' : ''} ${locked ? 'locked' : ''}`}
                      disabled={locked}
                      onClick={() => startTour(tour.id)}
                    >
                      <div className="tour-card-icon">{tour.icon}</div>
                      <div className="tour-card-content">
                        <div className="tour-card-header-row">
                          <strong className="tour-card-title">
                            {typeof tour.order === 'number' && tour.order < 90 ? `Iteration ${tour.order} · ` : ''}
                            {tour.title}
                          </strong>
                          <span
                            className="tour-card-role"
                            style={{ background: ROLE_COLORS[tour.role] || '#475569' }}
                          >
                            {tour.role}
                          </span>
                        </div>
                        <p className="tour-card-desc">{tour.description}</p>
                        <div className="tour-card-meta">
                          <span className="tour-meta-steps">
                            📍 {tour.id === 'workflow-full' ? getSteps(tour.id).length : tour.steps.length} steps
                          </span>
                          <span className="tour-meta-time">⏱️ ~{tour.estimatedMinutes} min</span>
                          {locked && <span className="tour-meta-lock">🔒 Sign in required</span>}
                        </div>
                      </div>
                      <span className="tour-card-arrow">▶</span>
                    </button>
                  );
                })}
              </div>

              {!authenticated && (
                <div className="tour-hub-intro">
                  <span>⚠️</span>
                  <span>
                    You are on the sign-in screen. Run <strong>Iteration 1</strong> now, then sign in and reopen the
                    tour to unlock iterations 2 – 10.
                  </span>
                </div>
              )}
            </div>

            <div className="tour-hub-footer">
              <button className="primary-button" onClick={() => startTour(authenticated ? 'iteration-2-workspace' : 'iteration-1-signin')}>
                🚀 {authenticated ? 'Start the workflow tour' : 'Start the sign-in tour'}
              </button>
              <button className="secondary-button" onClick={() => setHubOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {session && (
        <div className="tour-hud" role="region" aria-label="Tour controls">
          <div className="tour-hud-progress">
            <div className="tour-hud-progress-bar" style={{ width: `${progress}%` }} />
          </div>

          <div className="tour-hud-main">
            <div className="tour-hud-meta">
              <span className="tour-hud-engine">{engineMeta.label}</span>
              <span className="tour-hud-title">
                {currentStep?.groupTitle || getTour(session.tourId)?.title}
              </span>
              <span className="tour-hud-counter">
                Step {session.index + 1} / {session.total}
              </span>
            </div>

            <div className="tour-hud-controls">
              <button
                type="button"
                className="tour-hud-btn"
                onClick={prev}
                disabled={session.index === 0}
                title="Previous step (←)"
              >
                ← Back
              </button>
              <button
                type="button"
                className={`tour-hud-btn play ${session.playing ? 'playing' : ''}`}
                onClick={togglePlay}
                title="Play / pause autoplay (Space)"
              >
                {session.playing ? '⏸ Pause' : '▶ Play'}
              </button>
              <button type="button" className="tour-hud-btn primary" onClick={next} title="Next step (→)">
                {session.index + 1 >= session.total ? '🎉 Finish' : 'Next →'}
              </button>
            </div>

            <div className="tour-hud-side">
              <select
                className="tour-hud-select"
                value={engineId}
                onChange={(e) => changeEngine(e.target.value)}
                title="Switch tour engine"
              >
                {ENGINE_META.map((engine) => (
                  <option key={engine.id} value={engine.id}>{engine.label}</option>
                ))}
              </select>
              <select
                className="tour-hud-select"
                value={speed}
                onChange={(e) => persistSpeed(Number(e.target.value))}
                title="Playback speed"
              >
                {SPEEDS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button type="button" className="tour-hud-btn ghost" onClick={finish} title="Exit tour (Esc)">
                ✕ Exit
              </button>
            </div>
          </div>

          <div className="tour-hud-rail">
            {activeSteps.map((step, idx) => (
              <button
                key={`${session.tourId}-${idx}`}
                type="button"
                className={`tour-hud-dot ${idx === session.index ? 'active' : ''} ${idx < session.index ? 'done' : ''}`}
                onClick={() => jumpTo(idx)}
                title={step.title}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default TourHub;
