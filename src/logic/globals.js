import { pages } from './pages.js'
import {
  qs as localQs, globQs as qs, copyArray, copyObject, inert
} from '../utils/dom.js'
import { getParams, getPageLink } from '../utils/appState.js'
import { renderPage, showPage } from '../ui/page.js'
import { message, openPopup, closePopup, floatingMsg } from '../ui/popupMessages.js';

const definedParams = ['from', 'page', 'settings', 'section', 'popup'];

function convertParams(params) {
  if (!params) return undefined;
  const cleared = copyObject(params);
  for (let prop in cleared) {
    if (definedParams.includes(prop)) delete cleared[prop];
  }
  return cleared;
}

const globals = {
  db: null,
  worker: null,
  pageName: null,
  pageInfo: null,
  settings: false,
  additionalBack: 0,
  historyCount: 0, // for legacy History API
  isPageReady: undefined,
  _cachedConfigFile: null,
  getPeriods,
  getList,
  _setCacheConfig,
  paintPage,
  message,
  openPopup: (...args) => openPopup(globals, ...args),
  closePopup: (...args) => closePopup(globals, ...args),
  pageButton,
  floatingMsg: (...args) => floatingMsg(globals, ...args),
  openSettings,
  closeSettings,
  checkPersist,
};

export function getGlobals() {
  return globals;
}

async function getPeriods() {
  const periods = {};
  await globals.db.getAll('periods', (per) => {
    periods[per.id] = per;
  });
  return periods;
}

async function getList(listName) {
  await globals._setCacheConfig();
  if (listName in globals._cachedConfigFile) {
    const list = globals._cachedConfigFile[listName];
    return copyArray(list);
  }
}

async function _setCacheConfig() {
  if (globals._cachedConfigFile) return;
  const raw = await fetch('./config.json');
  globals._cachedConfigFile = await raw.json();
}

async function paintPage(name, {
  dontPushHistory, replaceState, noAnim, params, dontClearParams
} = {}) {
  const timeLog = performance ? {
    page: name,
    build: performance.now(),
    showPage: null,
    script: null,
  } : {};
  globals.pageName = name;
  globals.isPageReady = false;
  const page = pages[name];
  const { container, content } = renderPage(globals, name, page);
  if (performance) timeLog.showPage = performance.now();
  await showPage(globals, qs('.current'), container, noAnim);
  if (performance) timeLog.showPage = performance.now() - timeLog.showPage;
  const link = getPageLink(name, convertParams(params), dontClearParams);
  if (dailerData.nav) {
    let historyAction = null;
    if (!dontPushHistory) historyAction = 'push';
    if (replaceState) historyAction = 'replace';
    if (historyAction) navigation.navigate(link, {
      state: globals.pageInfo || navigation.currentEntry.getState() || {},
      history: historyAction, info: {call: 'paintPage'}
    });
  } else {
    if (replaceState) history.replaceState(globals.pageInfo || history.state || {}, '', link);
    else if (!dontPushHistory) {
      globals.historyCount++;
      history.pushState(globals.pageInfo || history.state || {}, '', link);
    }
  }
  container.classList.remove('hided');
  container.classList.add('current');
  if (!params) params = getParams(`${dailerData.nav ? location.origin : ''}${link}`);
  if (performance) {
    timeLog.build = performance.now() - timeLog.build;
    timeLog.script = performance.now();
  }
  await page.script({ globals, page: content, params });
  globals.isPageReady = true;
  if (performance) {
    timeLog.script = performance.now() - timeLog.script;
    console.log(timeLog);
  }
}

function pageButton({emoji, title, onClick}) {
  const pageBtn = localQs('.pageBtn');
  Object.assign(pageBtn, {
    innerHTML: emoji, title, ariaLabel: title, onclick: onClick
  });
  pageBtn.removeAttribute('disabled');
  pageBtn.setAttribute('aria-hidden', 'false');
  pageBtn.style.display = 'block';
}

async function openSettings(section, dontPushHistory) {
  globals.isPageReady = false;
  qs('#settings').style.transform = 'none';
  inert.set(qs('.current'));
  inert.remove(qs('#settings'));
  globals.settings = true;
  const useSection = section && pages.settings.sections.includes(section);
  if (!dontPushHistory) {
    const link = `${location.href}&settings=open${useSection ? `&section=${section}` : ''}`
    if (dailerData.nav) {
      navigation.navigate(link, {
        state: {settings: true}, history: 'push', info: {call: 'settings'}
      });
    } else {
      globals.historyCount++;
      history.pushState({settings: true}, '', link);
    }
  }
  await pages.settings.opening({globals});
  if (useSection) qs(`[data-section="${section}"]`).scrollIntoView();
  globals.isPageReady = true;
}

async function closeSettings(callSettingsUpdate, backInHistory) {
  qs('#settings').removeAttribute('style');
  inert.remove(qs('.current'));
  inert.set(qs('#settings'));
  if (backInHistory) history.back();
  if (!callSettingsUpdate) return;
  if (!pages[globals.pageName].onSettingsUpdate) return;
  await pages[globals.pageName].onSettingsUpdate({
    globals, page: qs('.current .content')
  });
}

async function checkPersist() {
  const data = await globals.db.get('settings', 'persistentStorage');
  if (!data.support) return undefined;
  if (data.isPersisted) return data.isPersisted;
  data.attempts++;
  const response = await navigator.storage.persist();
  if (response) data.grantedAt = Date.now();
  await globals.db.set('settings', data);
  return response;
}
