export const qs = (elem, page) => q('querySelector', elem, page, true);
export const qsa = (elem, page) => q('querySelectorAll', elem, page, true);

export const globQs = (elem) => q('querySelector', elem);
export const globQsa = (elem) => q('querySelectorAll', elem);

function q(func, elem, page, local) {
  if (page) {
    if (!document.querySelector(`#${page}`)) return null;
    return document[func](`#${page} ${elem}`);
  }
  return document[func](`${local ? '.current ' : ''}${elem}`);
}

function rawShow(display, elem, data) {
  if (typeof elem === 'string') elem = qs(elem);
  if (data && typeof data !== 'number') elem.innerHTML = data;
  elem.style.display = display;
}
export const show = (...args) => rawShow('block', ...args);
export const showFlex = (...args) => rawShow('flex', ...args);
export const hide = (elem) => rawShow('none', elem);

export function getElements(...elems) {
  const resp = {};
  for (let elem of elems) {
    resp[elem] = qs(`#${elem}`);
  }
  return resp;
}

export function getValue(elem) {
  return Number(qs(`[data-id="${elem}"]`).dataset.value);
}

export const copyObject = (obj) => {
  const response = {};
  for (let name in obj) response[name] = obj[name];
  return response;
};

export const copyArray = (arr) => {
  const response = [];
  for (let elem of arr) {
    if (Array.isArray(elem)) {
      response.push(copyArray(elem));
    } else if (typeof elem == 'object') {
      response.push(copyObject(elem));
    } else { response.push(elem); }
  }
  return response;
};

export const intlDate = (date) => {
  return new Date(typeof date == 'string' ? Number(date) : date)
    .toLocaleDateString(navigator.language);
};

export const convertEmoji = (str) => {
  return str.replace(/<span class\="emojiSymbol"[\s\w-:()/;"=.]+>/g, '').replace(/<\/span>/g, '');
};

export function getParams(url) {
  const params = {};
  (url ? new URL(url) : location).search
    .replace('?', '')
    .split('&')
    .forEach((elem) => {
      const splitted = elem.split('=');
      params[splitted[0]] = splitted[1];
    });
  return params;
}

export function safeDataInteractions(elems) {
  const state = dailerData.nav ? navigation.currentEntry.getState() : history.state || {};
  for (let elem of elems) {
    if (state[elem]) qs(`#${elem}`).value = state[elem];
    qs(`#${elem}`).addEventListener('input', stateSave);
  }
}

function stateSave(e) {
  const state = {};
  state[e.target.id] = e.target.value;
  updateState(state);
}

export function createOptionsList(elem, options) {
  if (!elem) return;
  elem.innerHTML = '';
  for (let i = 0; i < options.length; i++) {
    const opt = document.createElement('option');
    opt.value = options[i].id || i;
    opt.textContent = options[i].title;
    if (options[i].selected) opt.selected = 'selected';
    if (options[i].disabled) opt.disabled = 'disabled';
    elem.append(opt);
  }
}

export function handleKeyboard(elem, noBubbeling) {
  if (!dailerData.isDesktop) return;
  elem.addEventListener('keydown', (e) => {
    if (['Enter', 'Space'].includes(e.code)) {
      if (noBubbeling && e.target !== elem) return;
      e.preventDefault();
      e.target.click();
    }
  });
}

const transform = 'translateY(3rem)';

export function togglableElement(elem, styleCode) {
  if (!elem || !styleCode) return;
  elem.classList.add('togglableElement');
  elem.setStyle = (styleCode) => {
    if (!['hided', 'showing'].includes(styleCode)) return;
    if (elem.children.length !== 2) return;
    elem.dataset.styleCode = styleCode;
    const value = styleCode == 'showing' ? 1 : 0;
    elem.children[0].style.transform = value ? 'none' : transform;
    elem.children[1].style.opacity = value;
  };
  elem.toggleStyle = () => {
    const newStyle = elem.dataset.styleCode == 'hided' ? 'showing' : 'hided';
    elem.setStyle(newStyle);
  };
  elem.setStyle(styleCode);
}

export function checkForFeatures(features) {
  let elem = document.createElement('div');
  for (let feat of features) {
    window.dailerData[feat] = feat in elem;
  }
  elem.remove();
  elem = null;
}

export function isDesktop() {
  if (navigator.userAgentData) return !navigator.userAgentData.mobile;
  if ('standalone' in navigator) return false;
  return window.matchMedia('(pointer: fine) and (hover: hover)').matches;
}

function mediaQuery(query) { return window.matchMedia(query).matches; }
export const isWideInterface = () => mediaQuery('(min-width: 470px)');
export const isDoubleColumns = () => mediaQuery('(min-width: 935px) and (orientation: landscape)');

function getPlatform() {
  const { userAgent, platform } = navigator;
  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  let os;

  if (macosPlatforms.indexOf(platform) !== -1) os = 'macOS';
  else if (iosPlatforms.indexOf(platform) !== -1) os = 'iOS';
  else if (windowsPlatforms.indexOf(platform) !== -1) os = 'Windows';
  else if (/Android/.test(userAgent)) os = 'Android';
  else if (/Linux/.test(platform)) os = 'Linux';

  return os;
}

export const platform = getPlatform();
export const isMacOS = platform === 'macOS';
export const isIOS = platform === 'iOS';
//export const isAndroid = platform === 'Android';
export const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);// || 'standalone' in navigator;

const focusables = [
  'button:not(:disabled)', 'input:not(:disabled)', '[role="button"]:not([disabled])'
].join(', ');

export const inert = {
  set(elem, dontSaveFocus) {
    if (!elem) return;
    const page = {};
    if (!dontSaveFocus) page.focused = document.activeElement;
    elem.setAttribute('inert', 'true');
    if (!dailerData.inert) {
      elem.ariaHidden = true;
      let focusableElems = elem.querySelectorAll(focusables);
      page.existentAttributes = new Map();
      for (let el of focusableElems) {
        page.existentAttributes.set(el, {
          disabled: el.disabled, tabIndex: el.tabIndex
        });
        el.disabled = true;
        el.tabIndex = -1;
      }
    }
    inert._cache.set(elem, page);
  },
  remove(elem, elemToFocus) {
    if (!elem) return;
    elem.removeAttribute('inert');
    const page = inert._cache.get(elem);
    if (!dailerData.inert) {
      elem.ariaHidden = false;
      if (page) for (let [el, saved] of page.existentAttributes) {
        el.disabled = saved.disabled; el.tabIndex = saved.tabIndex;
      }
    }
    if (!elemToFocus) elemToFocus = page && page.focused ? page.focused : elem.querySelector(focusables);
    if (elemToFocus) elemToFocus.focus();
  },
  _cache: new Map(),
  clearCache(elem) { inert._cache.delete(elem); }
};

export function syncGlobals(globals) {
  if (!globals.pageInfo) globals.pageInfo = {};
  const state = dailerData.nav
  ? (dailerData.forcedStateEntry || navigation.currentEntry).getState() : copyObject(history.state);
  Object.assign(globals.pageInfo, state);
}

export function updateState(updatedStateEntries) {
  let state = dailerData.nav ? navigation.currentEntry.getState() : copyObject(history.state);
  if (!state) state = {};
  for (let key in updatedStateEntries) {
    state[key] = updatedStateEntries[key];
  }
  dailerData.nav ? navigation.updateCurrentEntry({ state }) : history.replaceState(state, '', location.href);
}

export async function reloadApp(globals, page) {
  if (!dailerData.nav) {
    await globals.paintPage(page || 'main', { noAnim: true });
    return location.reload();
  }
  await navigation.reload({ info: {call: 'hardReload', page} }).finished;
}

export function showErrorPage(err) {
  const elem = document.createElement('div');
  elem.className = 'page error';
  elem.innerHTML = `
    <div class="content center doubleColumns">
      <h2 class="emoji">${emjs.salute}</h2>
      <h2>Something really goes wrong</h2>
      <h3>There is this something: ${err}</h3>
    </div>
    <div class="footer">
      <button>${emjs.reload} Reload app</button>
    </div>
  `;
  qsa('.page').forEach((page) => inert.set(page, true));
  document.body.append(elem);
  document.activeElement.blur();
  elem.querySelector('button').addEventListener('click', () => location.reload() );
  setTimeout(() => { elem.classList.add('showing'); }, 0);
}
