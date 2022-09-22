import { qs, qsa, globQs, copyObject } from './dom.js'
import { getToday } from '../pages/highLevel/periods.js'

export function getParams(url) {
  const params = {};
  (url ? new URL(url) : location).search
    .replace('?', '')
    .split('&')
    .forEach((elem) => {
      if (!elem) return;
      const splitted = elem.split('=');
      params[splitted[0]] = splitted[1];
    });
  return params;
}

export function getFirstPage(session) {
  if (!session.firstDayEver) return 'main';
  if (session.firstDayEver == getToday()) return 'main';
  return session.recaped < getToday() ? 'recap' : 'main';
}

export async function installApp(globals) {
  globals.installPrompt.prompt();
  const choice = await globals.installPrompt.userChoice;
  delete globals.installPrompt;
  if (choice.outcome === 'accepted' && !('onappinstalled' in window)) {
    await onAppInstalled(globals);
  }
  return choice.outcome === 'accepted';
}

export async function onAppInstalled(globals) {
  await globals.db.updateItem('settings', 'session', (session) => {
    session.installed = true;
  });
  const elem = globQs('.floatingMsg[data-id="install"]');
  if (elem) elem.remove();
  globQs('#install').style.display = 'none';
  globQs('#install').dataset.installed = 'true';
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
  const session = await globals.db.getItem('settings', 'session');
  await globals.paintPage(page || getFirstPage(session), { replaceState: true });
  await globals.paintPage('reloaded', { noAnim: true });
  history.back();
}

export function showErrorPage(globals, err) {
  const elem = document.createElement('div');
  elem.className = 'page error';
  elem.innerHTML = `
    <div class="content center doubleColumns">
      <h2 class="emoji">${emjs.salute}</h2>
      <h2>Something really went wrong</h2>
      <h3>${err}</h3>
    </div>
    <div class="footer">
      <button>${emjs.reload} Reload app</button>
    </div>
  `;
  qsa('.page').forEach((page) => inert.set(page, true));
  document.body.append(elem);
  document.activeElement.blur();
  elem.querySelector('button').addEventListener('click', async () => await reloadApp(globals));
  requestAnimationFrame(() => elem.classList.add('showing'));
}
