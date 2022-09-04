import { pages } from './pages.js'
import {
  qs as localQs, globQs as qs, globQsa as qsa, copyArray, inert, getParams
} from '../pages/highLevel/utils.js'

const getPageLink = (name, params = {}, dontClearParams) => {
  const base = dontClearParams ? location.href : location.origin + location.pathname;
  const getLink = (sign) => base + sign + `page=${name}`;
  const matcher = base.match(/(?:page=)(\w+)/);
  let link = base.includes('?')
  ? (base.includes('page') ? base.replace(matcher[1], name) : getLink('&'))
  : getLink('?');
  link = link.replace(/\&settings=\w+/, '');
  for (let prop in params) { link += `&${prop}=${params[prop]}`; }
  const url = new URL(link);
  return dailerData.nav ? url.pathname + url.search : link;
};

const globals = {
  db: null,
  worker: null,
  pageName: null,
  pageInfo: null,
  settings: false,
  additionalBack: 0,
  isPageReady: undefined,
  _cachedConfigFile: null,
  getPeriods,
  getList,
  _setCacheConfig,
  paintPage,
  message,
  openPopup,
  closePopup,
  pageButton,
  floatingMsg,
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
  globals.pageName = name;
  globals.isPageReady = false;
  const page = pages[name];
  const container = document.createElement('div');
  container.className = 'page current';
  container.id = name;
  container.innerHTML = `
    <div class="header">
      <h1>${page.header}</h1>
      <button class="pageBtn emojiBtn" title="Page button" disabled aria-hidden="true"></button>
      <button class="openSettings emojiBtn" title="Open settings" aria-label="Open settings">
        ${emjs.settings}
      </button>
    </div>
    <div class="content">${page.page}</div>
    <div class="footer">${page.footer}</div>
  `;
  container.addEventListener('transitionend', (e) => {
    if (!e.target.classList.contains('page')) return;
    e.target.style.removeProperty('will-change');
  });
  let body = document.body;
  if (!body) body = qs('body');
  body.append(container);
  const content = container.querySelector('.content');
  content.className = `content ${page.styleClasses || ''}`;
  if (page.styleClasses && page.styleClasses.includes('doubleColumns')) {
    content.setAttribute('focusgroup', 'horizontal');
  }
  await showPage(globals, qs('.current'), container, noAnim);
  const args = page.noSettings ? [undefined] : ['click', () => globals.openSettings()];
  container.querySelector('.openSettings')[page.noSettings ? 'remove' : 'addEventListener'](...args);
  const link = getPageLink(name, params, dontClearParams);
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
    else if (!dontPushHistory) history.pushState(globals.pageInfo || history.state || {}, '', link);
  }
  container.classList.remove('hided');
  container.classList.add('current');
  if (!params) params = getParams(`${location.origin}${link}`);
  await page.script({ globals, page: content, params });
  globals.isPageReady = true;
}

function message({state, text}) {
  const msg = qs('#message');
  msg.classList.add('animate');
  msg.style.setProperty('--color', state == 'fail' ? '#a30000' : '#008000');
  msg.innerHTML = `${emjs[state == 'fail' ? 'cross' : 'sign']} ${text}`;
  setTimeout( () => { msg.classList.remove('animate') }, 3000);
}

function openPopup({text, action, emoji, strictClosing}) {
  const popup = qs('#popup');
  if (strictClosing) popup.classList.add('strictClosing');
  popup.style.display = 'flex';
  inert.set(qs(globals.settings ? '#settings' : '.current'));
  inert.remove(popup, popup.querySelector('[data-action="cancel"]'));
  qs('#popup h2.emoji').innerHTML = emoji;
  qs('#popup h2:not(.emoji)').innerHTML = text;
  popup.querySelector('[data-action="confirm"]').onclick = async () => {
    await action();
    globals.closePopup();
  }
}

function closePopup(dontImpactToNavigation) {
  const popup = qs('#popup');
  inert.remove(qs(globals.settings ? '#settings' : '.current'));
  inert.set(popup);
  popup.classList.remove('strictClosing');
  popup.style.display = 'none';
  qs('[data-action="confirm"]').onclick = null;
  if (dontImpactToNavigation) return;
  const link = location.href.replace(/&popup=\w+/, '');
  dailerData.nav
  ? navigation.navigate(link, {
      state: globals.pageInfo || navigation.currentEntry.getState() || {},
      history: 'replace', info: {call: 'customReplace'}
    })
  : history.replaceState(globals.pageInfo || history.state || {}, '', link);
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

function floatingMsg({id, text, button, longButton, onClick, pageName, notFixed}) {
  const prevElem = localQs('.floatingMsg', pageName);
  if (prevElem) prevElem.remove();
  const elem = document.createElement('div');
  if (id) elem.dataset.id = id;
  const useLong = longButton && dailerData.isWideInterface;
  elem.className = `floatingMsg ${notFixed ? 'notFixed' : ''}`;
  elem.innerHTML = `
    <h3>${text}</h3>
    ${button
      ? `<button class="${useLong ? '' : 'noEmoji'}" style="${
        useLong ? 'display: inline-flex; align-items: center;' : ''
      }">${useLong ? longButton : button}</button>`
      : ''}
  `;
  const content = localQs('.content', pageName);
  content.append(elem);
  if (button && onClick) {
    localQs('.floatingMsg button', pageName).addEventListener('click', onClick);
  }
  if (!content.classList.contains('center')) {
    const existentDiv = localQs('.floatingDiv');
    const div = existentDiv || document.createElement('div');
    if (!existentDiv) div.className = 'floatingDiv';
    div.style.cssText = `
      min-height: ${elem.getBoundingClientRect().height}px;
      min-width: 1px;
      margin-top: 2rem;
    `;
    if (!existentDiv) content.append(div);
  }
  return elem;
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
    dailerData.nav
    ? navigation.navigate(link, {
        state: {settings: true}, history: 'push', info: {call: 'settings'}
      })
    : history.pushState({settings: true}, '', link);
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
  const data = await globals.db.getItem('settings', 'persistentStorage');
  if (!data.support) return undefined;
  if (data.isPersisted) return data.isPersisted;
  const response = await navigator.storage.persist();
  data.attempts++;
  if (response) data.grantedAt = Date.now();
  await globals.db.setItem('settings', data);
  return response;
}

export async function showPage(globals, prev, current, noAnim, noCleaning) {
  prev.style.willChange = 'transform';
  current.style.willChange = 'transform';
  prev.classList.remove('showing', 'current');
  prev.classList.add('hidePrevPage');
  current.classList.remove('hided');
  inert.set(prev);
  inert.remove(current);
  let done = false;
  const addShowing = () => {
    current.classList.add('showing');
    done = true;
  }
  noAnim ? addShowing() : setTimeout(addShowing, 10);
  if (!noCleaning) {
    for (let elem of qsa('.hided')) {
      elem.remove();
      inert.clearCache(elem);
    }
  } else {
    current.classList.add('current');
    if (pages[current.id].onPageShow) {
      await pages[current.id].onPageShow({globals, page: qs(`#${current.id} .content`)});
    }
  }
  return new Promise((res) => {
    const isDone = () => {done ? res() : setTimeout(isDone, 10)};
    isDone();
  });
}

export async function hidePage(globals, current, prevName, noPageUpdate) {
  inert.set(current);
  const prev = qs(`#${prevName}`);
  if (!prev) {
    if (!qs('#main')) await globals.paintPage('main', { replaceState: true });
    if (prevName !== 'main') await globals.paintPage(prevName, { dontPushHistory: true });
    return;
  }
  prev.style.willChange = 'transform';
  current.style.willChange = 'transform';
  prev.classList.remove('hidePrevPage', 'hided');
  prev.classList.add('showing', 'current');
  inert.remove(prev);
  current.classList.remove('showing', 'current');
  current.classList.add('hided');
  if (!noPageUpdate && pages[prev.id].onPageShow) {
    await pages[prev.id].onPageShow({globals, page: qs(`#${prev.id} .content`)});
  }
}
