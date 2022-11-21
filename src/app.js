import './app.scss'
import { getGlobals } from './logic/globals.js'
import { pages } from './logic/pages.js'
import { IDB, database } from './logic/IDB.js'
import { enableEmojis } from './logic/emojis.js'
import { deployWorkers } from './logic/deployWorkers.js'
import {
  renderFirstPage, renderAppState, onHistoryAPIBack, onAppNavigation, onTraverseNavigation
} from './logic/navigation.js'
import { globQs as qs, inert, convertEmoji } from './utils/dom.js'
import {
  showErrorPage, reloadApp, onAppInstalled, getFirstPage, getParams
} from './utils/appState.js'
import {
  checkForFeatures, isDesktop, isWideInterface, isDoubleColumns,
  platform, isIOS, isMacOS, isSafari
} from './logic/environment.js'
import { processSettings, toggleExperiments } from './pages/highLevel/settingsBackend.js'
import { checkInstall } from './pages/main.js'
import { toggleNotifReason } from './pages/settings/notifications.js'
import { clearDatabase } from './pages/debugPage.js'

if (!('at' in Array.prototype)) {
  function at(n) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    if (n < 0 || n >= this.length) return undefined;
    return this[n];
  }
  Object.defineProperty(Array.prototype, 'at', {
    value: at, writable: true, enumerable: false, configurable: true
  });
}

if (!window.dailerData) Object.defineProperty(window, 'dailerData', {
  value: {
    nav: 'navigation' in window ? true : false,
    forcePeriodPromo: false,
    forceReminderPromo: false,
    platform, isIOS, isMacOS, isSafari,
    isDesktop: isDesktop(),
    isWideInterface: isWideInterface(),
    isDoubleColumns: isDoubleColumns(),
    experiments: 0,
  },
  writable: false,
  configurable: false
});
checkForFeatures(['inert', 'focusgroup']);

Object.defineProperty(window.dailerData, 'isDev', {
  value: '{IS_DEV}'
});

const globals = getGlobals();

window.addEventListener('unhandledrejection', (e) => {
  showErrorPage(globals, e.reason);
});

window.addEventListener('pageshow', appEntryPoint);

async function appEntryPoint(e) {
  const timeLog = performance ? {
    wholeTime: performance.now(),
    openDb: performance.now(),
    deployWorkers: null,
    loadEmoji: null,
    processSettings: null,
    paintUnvisibles: null,
    startApp: null,
  } : {};
  createDb();
  if (e.persisted) return;
  if (performance) {
    timeLog.openDb = performance.now() - timeLog.openDb;
    timeLog.deployWorkers = performance.now();
  }
  document.documentElement.lang = navigator.language;
  const { worker, periodicSync } = await deployWorkers(globals);
  globals.worker = worker;
  if (performance) {
    timeLog.deployWorkers = performance.now() - timeLog.deployWorkers;
    timeLog.processSettings = performance.now();
  }
  await processSettings(globals, periodicSync);
  if (performance) {
    timeLog.processSettings = performance.now() - timeLog.processSettings;
    timeLog.loadEmoji = performance.now();
  }
  await enableEmojis(globals);
  if (performance) {
    timeLog.loadEmoji = performance.now() - timeLog.loadEmoji;
    timeLog.paintUnvisibles = performance.now();
  }
  toggleExperiments();
  pages.settings.fillHeader({page: qs('#settings > .header')});
  await pages.settings.paint({globals, page: qs('#settings > .content')});
  inert.set(qs('#settings'), true);
  inert.set(qs('#popup'), true);
  if (performance) {
    timeLog.paintUnvisibles = performance.now() - timeLog.paintUnvisibles;
    timeLog.startApp = performance.now();
  }
  await migrateData();
  dailerData.nav ? await startApp() : await renderAppState(e, false, globals);
  if (performance) {
    timeLog.startApp = performance.now() - timeLog.startApp;
    timeLog.wholeTime = performance.now() - timeLog.wholeTime;
    console.log(timeLog);
  }
}

window.addEventListener('pagehide', () => {
  if (globals.db) {
    globals.db.db.close();
    globals.db = null;
  }
});

function createDb() {
  if (!globals.db) globals.db = new IDB(
    database.name, database.version, database.stores, {
      showErrorsAsLogs: true
    }
  );
}

async function migrateData() {
  const migrationDay = Number('{MIGRATION_DAY}');
  const session = await globals.db.get('settings', 'session');
  if (Number.isFinite(session.isHistoryMigrated)) return;
  if (session.firstDayEver < migrationDay) {
    await clearDatabase(globals);
    session.firstDayEver = null;
    session.isHistoryMigrated = 1;
    await globals.db.set('settings', session);
  }
}

async function startApp() {
  const appHistory = navigation.entries();
  for (let i = 0; i < appHistory.length; i++) {
    if (appHistory[i].url.includes('/tools')) {
      appHistory.splice(i, 1);
      i--;
    }
  }
  appHistory.length <= 1 || !getParams(appHistory.at(-1).url).page
  ? await renderFirstPage(globals) : await restoreApp(appHistory);
}

async function restoreApp(appHistory) {
  const session = await globals.db.get('settings', 'session');
  for (let entry of appHistory) {
    dailerData.forcedStateEntry = entry;
    const params = getParams(entry.url);
    if (!params.page) continue;
    const isPageExist = qs(`#${params.page}`) ? true : false;
    if (isPageExist && !params.settings) {
      await reloadApp(globals);
      return;
    }
    if (['main', 'recap'].includes(params.page)) {
      params.page = getFirstPage(session);
    }
    if (params.settings) {
      await globals.openSettings(params.section, true);
    } else {
      if (globals.settings) await globals.closeSettings();
      if (!isPageExist) await globals.paintPage(params.page, {
        dontPushHistory: true, noAnim: true, params
      });
    }
  }
  dailerData.forcedStateEntry = null;
  const diff = appHistory.length - 1 - navigation.currentEntry.index;
  if (diff > 0) await onTraverseNavigation(globals, {
    from: {index: appHistory.length - 1},
    destination: {index: navigation.currentEntry.index}
  }, true);
  await updatePageTitle();
  globals.message({
    state: 'success', text: 'Previously opened dailer session has been fully restored'
  });
}

if ('navigation' in window) navigation.addEventListener('navigatesuccess', updatePageTitle);

async function updatePageTitle() {
  const params = getParams();
  const page = pages[params.settings ? 'settings' : params.page];
  if (page.dynamicTitle) {
    await new Promise((res) => {
      const isReady = () => setTimeout(() => globals.isPageReady ? res() : isReady(), 10);
      isReady();
    });
  }
  const te = page.titleEnding || 'text';
  const def = ` dailer ${emjs.sign}`;  // default value
  qs('title').innerHTML = convertEmoji(`${page.title || page.header}${
    te == 'text' ? ' in' + def : (te == 'line' ? ' |' + def : '')
  }`);
}

window.addEventListener('popstate', async (e) => await onHistoryAPIBack(e, globals));

if ('navigation' in window) {
  navigation.addEventListener('navigate', (e) => onAppNavigation(e, globals));
}

window.addEventListener('beforeinstallprompt', async (e) => {
  e.preventDefault();
  if (dailerData.isDev) return;
  globals.installPrompt = e;
  const session = await globals.db.update('settings', 'session', (session) => {
    session.installed = false;
  });
  if (qs('#settings .content').innerHTML !== '') {
    toggleNotifReason(session, null, globals);
  }
  if (qs('#main')) await checkInstall(globals);
});

window.addEventListener('appinstalled', async () => await onAppInstalled(globals));

qs('#popup').addEventListener('click', (e) => {
  const popup = qs('#popup');
  if (popup.classList.contains('strictClosing') && e.target === popup) return;
  if (e.target.dataset.action == 'cancel') globals.closePopup();
});
qs('#popup').addEventListener('keydown', (e) => {
  if (e.code == 'Escape') globals.closePopup();
});
