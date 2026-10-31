/**
 * engines.js – Adapter layer that runs the SAME tour content through five
 * different product-tour libraries:
 *
 *   driver.js · intro.js · shepherd.js · hopscotch · bootstrap-tour
 *
 * Every adapter exposes the same tiny interface so the orchestrator in
 * TourSystem.jsx can drive any engine identically:
 *
 *   { id, label, show(step), destroy() }
 *
 * `show(step)` renders exactly ONE step (highlight + tooltip). All of the
 * navigation, progress, cross-page routing and autoplay logic lives in the
 * orchestrator, which keeps behaviour identical across the five engines.
 *
 * Libraries and their stylesheets are loaded lazily (dynamic import) so the
 * initial application bundle is not inflated by five tour frameworks.
 */

const CSS_CACHE = new Set();

async function loadCss(key, importer) {
  if (CSS_CACHE.has(key)) return;
  CSS_CACHE.add(key);
  await importer();
}

/* ------------------------------------------------------------------ */
/* 1. Driver.js                                                        */
/* ------------------------------------------------------------------ */
async function driverEngine() {
  const { driver } = await import('driver.js');
  await loadCss('driver', () => import('driver.js/dist/driver.css'));

  let instance = null;
  return {
    id: 'driver',
    label: 'Driver.js',
    async show(step) {
      if (instance) { try { instance.destroy(); } catch { /* noop */ } instance = null; }
      instance = driver({
        showButtons: false,
        showProgress: false,
        allowClose: false,
        overlayOpacity: 0.62,
        stagePadding: 8,
        stageRadius: 12,
        smoothScroll: true,
        animate: true,
        popoverClass: 'tcms-tour-popover tcms-engine-driver',
        steps: [
          {
            element: step.anchor || undefined,
            popover: {
              title: step.title,
              description: step.body,
              side: step.side || 'bottom',
              align: step.align || 'center',
            },
          },
        ],
      });
      instance.drive();
    },
    destroy() {
      if (instance) { try { instance.destroy(); } catch { /* noop */ } instance = null; }
    },
  };
}

/* ------------------------------------------------------------------ */
/* 2. Intro.js                                                         */
/* ------------------------------------------------------------------ */
async function introEngine() {
  const introJs = (await import('intro.js')).default;
  await loadCss('intro', () => import('intro.js/introjs.css'));

  let instance = null;
  return {
    id: 'intro',
    label: 'Intro.js',
    async show(step) {
      if (instance) { try { instance.exit(true); } catch { /* noop */ } instance = null; }
      instance = introJs();
      instance.setOptions({
        steps: [{ element: step.anchor || undefined, title: step.title, intro: step.body }],
        showButtons: false,
        showBullets: false,
        showProgress: false,
        showStepNumbers: false,
        exitOnEsc: false,
        exitOnOverlayClick: false,
        keyboardNavigation: false,
        disableInteraction: true,
        tooltipClass: 'tcms-tour-popover tcms-engine-introjs',
        highlightClass: 'tcms-introjs-highlight',
        tooltipPosition: step.side || 'bottom',
      });
      instance.start();
    },
    destroy() {
      if (instance) { try { instance.exit(true); } catch { /* noop */ } instance = null; }
    },
  };
}

/* ------------------------------------------------------------------ */
/* 3. Shepherd.js                                                      */
/* ------------------------------------------------------------------ */
async function shepherdEngine() {
  const Shepherd = (await import('shepherd.js')).default;
  await loadCss('shepherd', () => import('shepherd.js/dist/css/shepherd.css'));

  let tour = null;
  return {
    id: 'shepherd',
    label: 'Shepherd.js',
    async show(step) {
      if (tour) { try { tour.cancel(); tour.destroy(); } catch { /* noop */ } tour = null; }

      tour = new Shepherd.Tour({
        useModalOverlay: true,
        exitOnEsc: false,
        keyboardNavigation: false,
        defaultStepOptions: {
          scrollTo: { behavior: 'smooth', block: 'center' },
          classes: 'tcms-tour-popover tcms-engine-shepherd',
          modalOverlayOpeningPadding: 8,
          modalOverlayOpeningRadius: 12,
          cancelIcon: { enabled: false },
        },
      });

      const stepConfig = {
        id: 'tcms-step',
        title: step.title,
        text: step.body,
        buttons: [],
      };
      if (step.anchor) stepConfig.attachTo = { element: step.anchor, on: step.side || 'bottom' };
      else stepConfig.classes = 'tcms-tour-popover tcms-engine-shepherd tcms-tour-centered';

      tour.addStep(stepConfig);
      tour.start();
    },
    destroy() {
      if (tour) { try { tour.cancel(); tour.destroy(); } catch { /* noop */ } tour = null; }
    },
  };
}

/* ------------------------------------------------------------------ */
/* 4. Hopscotch                                                        */
/* ------------------------------------------------------------------ */
async function hopscotchEngine() {
  const mod = await import('hopscotch');
  const hopscotch = mod.default || mod;
  await loadCss('hopscotch', () => import('hopscotch/dist/css/hopscotch.css'));

  let active = false;
  return {
    id: 'hopscotch',
    label: 'Hopscotch',
    async show(step) {
      if (active) { try { hopscotch.endTour(true); } catch { /* noop */ } active = false; }
      hopscotch.startTour(
        {
          id: 'tcms-hopscotch-tour',
          steps: [
            {
              element: step.anchor || 'body',
              title: step.title,
              content: step.body,
              placement: step.side || 'bottom',
              multipage: false,
              yOffset: 8,
            },
          ],
          showPrevButton: false,
          showNextButton: false,
          showCloseButton: false,
          showCTAButton: false,
          showOnlyTourOnScreen: false,
          scrollTopMargin: 120,
        },
        0
      );
      active = true;
    },
    destroy() {
      if (active) { try { hopscotch.endTour(true); } catch { /* noop */ } active = false; }
    },
  };
}

/* ------------------------------------------------------------------ */
/* 5. Bootstrap Tour                                                   */
/* ------------------------------------------------------------------ */
const BT_TEMPLATE = `
  <div class="popover tcms-tour-popover tcms-engine-bootstrap-tour" role="dialog">
    <div class="arrow"></div>
    <h3 class="popover-title"></h3>
    <div class="popover-content"></div>
  </div>
`;

async function bootstrapTourEngine() {
  // bootstrap-tour needs jQuery on the global scope.
  const jQuery = (await import('jquery')).default;
  if (typeof window !== 'undefined') {
    window.jQuery = window.jQuery || jQuery;
    window.$ = window.$ || jQuery;
  }
  await loadCss('bootstrap-tour', () => import('bootstrap-tour/build/css/bootstrap-tour.css'));
  const mod = await import('bootstrap-tour');
  const Tour = mod.default || mod;

  let tour = null;
  return {
    id: 'bootstrap-tour',
    label: 'Bootstrap Tour',
    async show(step) {
      if (tour) { try { tour.end(); } catch { /* noop */ } tour = null; }
      tour = new Tour({
        name: 'tcms-bt-tour',
        storage: false,
        backdrop: true,
        backdropPadding: 8,
        template: BT_TEMPLATE,
        steps: [
          {
            element: step.anchor || 'body',
            title: step.title,
            content: step.body,
            placement: step.side || 'bottom',
            orphan: true,
          },
        ],
      });
      tour.start();
    },
    destroy() {
      if (tour) { try { tour.end(); } catch { /* noop */ } tour = null; }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */
const FACTORIES = {
  driver: driverEngine,
  intro: introEngine,
  shepherd: shepherdEngine,
  hopscotch: hopscotchEngine,
  'bootstrap-tour': bootstrapTourEngine,
};

export const ENGINE_IDS = Object.keys(FACTORIES);

/** Build an engine adapter; throws a readable error if the library fails. */
export async function createEngine(id) {
  const factory = FACTORIES[id] || FACTORIES.driver;
  return factory();
}
