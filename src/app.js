import { getGlobals, showPage, hidePage } from './logic/globals.js'
import { pages } from './logic/pages.js'
import { IDB, database } from './logic/IDB.js'
import {
  renderFirstPage, renderPage, onHistoryAPIBack, onAppNavigation,
  onTraverseNavigation, externalNavigate
} from './logic/navigation.js'
import { globQs as qs, inert, convertEmoji } from './utils/dom.js'
import {
  showErrorPage, reloadApp, onAppInstalled, getFirstPage, getParams
} from './utils/appState.js'
import {
  checkForFeatures, isDesktop, isWideInterface, isDoubleColumns,
  platform, isIOS, isMacOS, isSafari
} from './logic/environment.js'
import { getToday, oneDay } from './pages/highLevel/periods.js'
import { processSettings, toggleExperiments } from './pages/highLevel/settingsBackend.js'
import { checkInstall } from './pages/main.js'
import { registerPeriodicSync, toggleNotifReason } from './pages/settings/notifications.js'

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
  createDb();
  if (e.persisted) return;
  document.documentElement.lang = navigator.language;
  const { worker, periodicSync } = await deployWorkers();
  globals.worker = worker;
  await loadEmojiList();
  await processSettings(globals, periodicSync);
  toggleExperiments();
  pages.settings.fillHeader({page: qs('#settings > .header')});
  await pages.settings.paint({globals, page: qs('#settings > .content')});
  inert.set(qs('#settings'), true);
  inert.set(qs('#popup'), true);
  dailerData.nav ? await startApp() : await renderPage(e, false, globals);
}

window.addEventListener('pagehide', () => {
  if (globals.db) {
    globals.db.db.close();
    globals.db = null;
  }
});

function createDb() {
  if (!globals.db) globals.db = new IDB(database.name, database.version, database.stores);
}

async function unregisterPreviousSW() {
  const regs = await navigator.serviceWorker.getRegistrations();
  for (let reg of regs) {
    if (!reg.active.scriptURL.includes('/tools')) continue;
    await reg.unregister();
  }
}

async function deployWorkers() {
  const resp = {
    worker: null, periodicSync: { support: false }
  };
  if (!('serviceWorker' in navigator && 'caches' in window)) return resp;
  await unregisterPreviousSW();
  const reg = await navigator.serviceWorker.register('./sw.js');
  navigator.serviceWorker.onmessage = async (e) => {
    if (typeof e.data !== 'object') return;
    await externalNavigate(globals, e.data.navigate);
  };
  if ('launchQueue' in window && 'targetURL' in LaunchParams.prototype) {
    launchQueue.setConsumer(async (launchParams) => {
      await externalNavigate(globals, launchParams.targetURL);
    });
  }
  const worker = new Worker('./workers/mainWorker.js');
  worker._callsList = new Map();
  worker.call = setCallListener(worker);
  worker.onmessage = (e) => {
    if (e.data.error) return showErrorPage(globals, e.data.error);
    worker._callsList.set(e.data._id, { data: e.data.data, used: false });
  };
  worker.postMessage({isWorkerReady: false});
  resp.worker = worker;
  if (!('permissions' in navigator)) return resp;
  const isPeriodicSyncSupported = 'periodicSync' in reg;
  resp.periodicSync.support = isPeriodicSyncSupported;
  if (!isPeriodicSyncSupported) return resp;
  resp.periodicSync.permission = await registerPeriodicSync(reg);
  return resp;
}

function setCallListener(worker) {
  return async (call = {}) => {
    for (let [key, value] of worker._callsList) {
      if (value.used) worker._callsList.delete(key);
    }
    if (typeof call !== 'object') return;
    call._id = Date.now();
    worker.postMessage(call);
    await new Promise((res, rej) => {
      const isReady = () => worker._callsList.has(call._id) ? res() : setTimeout(isReady, 10);
      isReady();
    });
    const resp = worker._callsList.get(call._id);
    resp.used = true;
    return resp.data;
  };
}

function getEmojiLink(emoji) {
  return `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/svg/emoji_u${
    _emojiList[emoji]
  }.svg`;
}

async function loadEmojiList() {
  const resp = await fetch('./emoji.json');
  window._emojiList = await resp.json();
  const loadArray = [];
  const isAppleEmoji = dailerData.isIOS || dailerData.isMacOS;
  if (!isAppleEmoji) for (let name in _emojiList) {
    const link = getEmojiLink(name);
    loadArray.push(fetch(link));
  }
  await Promise.all(loadArray);
  window.emjs = new Proxy({}, {
    get(target, prop) {
      if (!(prop in _emojiList)) return '';
      const html = `&#x${_emojiList[prop]};`;
      if (isAppleEmoji) return html;
      const style = `background-image: url(${getEmojiLink(prop)});`;
      return `<span class="emojiSymbol" style="${style}">${html}</span>`;
    }
  });
  window.hasEmoji = (elem) => typeof elem == 'string' ? elem.includes('emojiSymbol') : undefined;
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
  const session = await globals.db.getItem('settings', 'session');
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
  globals.installPrompt = e;
  const session = await globals.db.updateItem('settings', 'session', (session) => {
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
