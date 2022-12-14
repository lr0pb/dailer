import { pages } from './pages.js'
import { popups } from '../pages/popups.js'
import { showPage, hidePage } from '../ui/page.js'
import { globQs as qs, globQsa as qsa } from '../utils/dom.js'
import { getToday } from '../pages/highLevel/periods.js'
import { getFirstPage, getParams } from '../utils/appState.js'

async function verifyRenderPage(globals, params) {
  const session = await globals.db.get('settings', 'session');
  const firstPage = getFirstPage(session);
  const onbrd = session.onboarded;
  if (!onbrd) return { rndr: 'onboarding' };
  let page = (params.page && pages[params.page]) ? params.page : firstPage;
  if (onbrd && page == 'onboarding') page = firstPage;
  if (page == 'recap' && session.recaped == getToday()) page = 'main';
  if (page == 'main') page = firstPage;
  return { rndr: page, firstPage };
}

export async function renderFirstPage(globals) {
  const params = getParams();
  const { rndr, firstPage } = await verifyRenderPage(globals, params);
  if (['main', 'recap', 'onboarding'].includes(rndr)) {
    await globals.paintPage(rndr, {
      replaceState: true, params, dontClearParams: true
    });
  } else {
    await globals.paintPage(firstPage, { replaceState: true, noAnim: true });
    await globals.paintPage(rndr, { params });
  }
  await processPageBuilding(globals, params);
}

async function processPageBuilding(globals, params) {
  if (params.settings) await globals.openSettings(params.section);
  if (params.popup && params.popup in popups) {
    const popupData = popups[params.popup](globals);
    globals.openPopup(popupData);
  }
}

export async function renderAppState(e, back, globals) {
  if (!back) return renderFirstPage(globals);
  const params = getParams();
  if (params.settings == 'open') {
    if (globals.pageName !== params.page) {
      await hidePage(globals, qs('.current'), params.page);
      globals.pageName = params.page;
    }
    await globals.openSettings(null, true);
    return;
  }
  if (globals.settings) {
    globals.settings = false;
    await globals.closeSettings(back, false);
    return;
  }
  globals.pageName = params.page;
  const session = await globals.db.get('settings', 'session');
  const rndr = (params.page && pages[params.page]) ? params.page : getFirstPage(session);
  globals.closePopup();
  await hidePage(globals, qs('.current'), rndr);
}

export async function onHistoryAPIBack(e, globals) {
  if (dailerData.nav) return;
  if (globals.traverseBack) return;
  globals.historyCount--;
  if (pages[globals.pageName].onBack) {
    pages[globals.pageName].onBack(globals);
  }
  await renderAppState(e, true, globals);
  if (globals.additionalBack) {
    const backs = globals.additionalBack;
    globals.additionalBack = 0;
    for (let i = 0; i < backs; i++) { history.back() }
  }
}

const callsList = ['paintPage', 'settings', 'additionalBack', 'customTraverse', 'customReplace'];
const instantPromise = () => new Promise((res) => { res() });

export function onAppNavigation(e, globals) {
  console.log(e);
  if (!dailerData.nav) return;
  if (!e.canIntercept && !e.canTransition) return;
  if (e.destination.url.includes('/tools')) return;
  const info = e.info || {};
  if (info.call === 'hardReload') return 'intercept' in e
  ? e.intercept({ focusReset: 'manual', async handler() { await hardReload(globals, info) } })
  : e.transitionWhile(hardReload(globals, info));
  if (e.downloadRequest || e.navigationType == 'reload') return;
  if (
    callsList.includes(info.call) || e.navigationType !== 'traverse'
  ) {
    return 'intercept' in e
    ? e.intercept({ focusReset: 'manual', async handler() { await instantPromise() } })
    : e.transitionWhile(instantPromise());
  }
  'intercept' in e
  ? e.intercept({ focusReset: 'manual', async handler() { await onTraverseNavigation(globals, e) } })
  : e.transitionWhile(onTraverseNavigation(globals, e));
}

async function hardReload(globals) {
  const appHistory = navigation.entries();
  let firstEntry = null;
  for (let i = 0; i < appHistory.length; i++) {
    const entry = appHistory[i];
    if (!entry.url.includes('/tools') && getParams(entry.url).page) {
      firstEntry = entry; break;
    }
  }
  await navigation.traverseTo(firstEntry.key, {
    info: {call: 'customTraverse'}
  }).finished;
  qs('.hidePrevPage').classList.add('current');
  for (let page of qsa('.page:not(.basic)')) {
    page.remove();
  }
  await globals.closeSettings();
  qs('#settings > .content').innerHTML = '';
  await pages.settings.paint({globals, page: qs('#settings > .content')});
}

export async function onTraverseNavigation(globals, e, silent) {
  const from = e.from || ('intercept' in e ? navigation.transition.from : navigation.currentEntry);
  const idx = from.index;
  const rawDelta = idx - e.destination.index;
  let delta = Math.abs(rawDelta);
  const dir = rawDelta > 0 ? -1 : 1; // -1 stands for backward, 1 stands for forward
  const appHistory = navigation.entries();
  globals.closePopup(true);
  for (let i = 0; i < delta; i++) {
    const currentIndex = idx + i * dir;
    const nextIndex = currentIndex + dir;
    const currentParams = getParams(appHistory[currentIndex].url);
    const nextParams = getParams(appHistory[nextIndex].url);
    if (!nextParams.page) continue;
    const settings = currentParams.settings || nextParams.settings;
    const differentPages = currentParams.page !== nextParams.page;
    if (!silent && dir === -1 && pages[currentParams.page].onBack) {
      pages[currentParams.page].onBack(globals);
    }
    globals.pageName = nextParams.page;
    if (settings) {
      if (differentPages) {
        dir === -1
        ? await globals.openSettings(currentParams.section, true) : await globals.closeSettings();
      } else {
        dir === -1
        ? await globals.closeSettings(!silent) : await globals.openSettings(nextParams.section, true);
      }
    }
    if (!settings || (settings && differentPages)) {
      dir === -1
      ? await hidePage(globals, qs('.current'), nextParams.page, silent)
      : await showPage(globals, qs('.current'), qs(`#${nextParams.page}`), false, true);
    }
    if (!silent && i === 0 && delta === 1 && dir === -1 && globals.additionalBack) {
      delta += globals.additionalBack;
      const finalIndex = idx + delta * dir;
      await navigation.traverseTo(appHistory[finalIndex].key, {
        info: {call: 'additionalBack'}
      }).finished;
      globals.additionalBack = 0;
    }
  }
}

export async function externalNavigate(globals, link) {
  const params = getParams(link);
  if (!dailerData.nav) return;
  const appHistory = navigation.entries();
  const current = navigation.currentEntry;
  if (!params.page) {
    params.page = getParams(current.url).page;
    link += `&page=${params.page}`;
  };
  let existentEntry = null;
  for (let entry of appHistory) {
    const entryParams = getParams(entry.url);
    if (entryParams.page === params.page) {
      existentEntry = entry; break;
    }
  }
  if (existentEntry && existentEntry !== current) {
    await navigation.traverseTo(existentEntry.key).finished;
  } else if (!existentEntry) {
    if (!pages[params.page]) return;
    const { rndr } = await verifyRenderPage(globals, params);
    await globals.paintPage(rndr);
  }
  await navigation.navigate(link, {
    state: globals.pageInfo || navigation.currentEntry.getState() || {},
    history: 'replace', info: {call: 'customReplace'}
  }).finished;
  await processPageBuilding(globals, params);
}
