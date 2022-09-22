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

function rawShow(display, elem, data, isGlob) {
  if (typeof elem === 'string') elem = (isGlob ? globQs : qs)(elem);
  if (data && typeof data !== 'number') elem.innerHTML = data;
  elem.style.display = display;
}
export const show = (...args) => rawShow('block', ...args);
export const showFlex = (...args) => rawShow('flex', ...args);
export const hide = (elem, isGlob) => rawShow('none', elem, null, isGlob);

export function getElements(...elems) {
  const resp = {};
  for (let elem of elems) {
    resp[elem] = qs(`#${elem}`);
  }
  return resp;
}

export function getValue(elemId) {
  return Number(qs(`[data-id="${elemId}"]`).dataset.value);
}

export function getDate(elem) {
  return new Date(elem.value).getTime();
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

export const convertEmoji = (str) => {
  return str.replace(/<span class\="emojiSymbol"[\s\w-:()/;"=.]+>/g, '').replace(/<\/span>/g, '');
};

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
  clearCache(elem) {
    if (dailerData.inert) return;
    inert._cache.delete(elem);
  }
};
