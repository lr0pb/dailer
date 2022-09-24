import { pages } from '../logic/pages.js'
import { globQs as qs, globQsa as qsa, inert } from '../utils/dom.js'
import { getParams } from '../utils/appState.js'

export function renderPage(globals, name, page) {
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
    <div class="footer abs">${page.footer}</div>
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
  const args = page.noSettings ? [undefined] : ['click', () => globals.openSettings()];
  container.querySelector('.openSettings')[page.noSettings ? 'remove' : 'addEventListener'](...args);
  return { container, content };
}

function getPageShowArgs(globals, elem) {
  return {
    globals, page: qs(`#${elem.id} .content`), params: getParams()
  };
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
  noAnim ? addShowing() : requestAnimationFrame(addShowing);
  if (!noCleaning) {
    qsa('.hided').forEach((elem) => {
      elem.remove();
      inert.clearCache(elem);
    });
  } else {
    current.classList.add('current');
    if (pages[current.id].onPageShow) {
      await pages[current.id].onPageShow(getPageShowArgs(globals, current));
    }
  }
  return new Promise((res) => {
    const isDone = () => { done ? res() : requestAnimationFrame(isDone) };
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
    await pages[prev.id].onPageShow(getPageShowArgs(globals, prev));
  }
}
