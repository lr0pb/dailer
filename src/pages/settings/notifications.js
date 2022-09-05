import { globQs as qs, globQsa as qsa } from '../highLevel/utils.js'
import { renderToggler, toggleFunc } from '../highLevel/taskThings.js'
import { installApp } from '../main.js'

export async function isNotificationsAvailable(globals) {
  const periodicSync = await globals.db.getItem('settings', 'periodicSync');
  if (dailerData.isIOS || dailerData.isMacOS || !('Notification' in window) || !periodicSync.support) {
    return false;
  }
  const session = await globals.db.getItem('settings', 'session');
  if (!session.installed && !globals.installPrompt) return false;
  return true;
}

export async function addNotifications(globals) {
  const isSupported = await isNotificationsAvailable(globals);
  if (!isSupported) {
    return qs('.notifStyle').innerHTML = '.notif { display: none !important; }';
  }
  const session = await globals.db.getItem('settings', 'session');
  const notifications = await globals.db.getItem('settings', 'notifications');
  const currentValue = getNotifPerm(session, null, notifications.enabled);
  toggleNotifReason(session, currentValue, globals);
  renderToggler({
    name: `${emjs.bell} Enable notifications`, id: 'notifications', buttons: [{
      emoji: getEmoji(session, null, notifications.enabled),
      func: onNotifTogglerClick, args: { globals }
    }], page: qs('#notifications'), value: currentValue
  });
}

function getNotifPerm(session, value, enabled) {
  if (!value) value = Notification.permission;
  if (value == 'granted') return enabled ? 1 : 0;
  return !session.installed ? 3 : value == 'denied' ? 2 : 0;
}

function getEmoji(session, notifPerm, enabled, forcedValue) {
  const value = forcedValue !== undefined
  ? forcedValue : getNotifPerm(session, notifPerm, enabled);
  return emjs[value == 1 ? 'sign' : value == 2 ? 'cross' : value == 3 ? 'lock' : 'blank'];
}

function isBadValue(value) {
  return [2, 3].includes(value);
}

export function toggleNotifReason(session, value, globals) {
  if (!value && value !== 0) value = getNotifPerm(session);
  if (isBadValue(value)) {
    qs('#notifTopics').innerHTML = '';
    qs('#notifReason').innerHTML = value == 2
    ? `${emjs.warning} You denied in notifications permission, so grant it via site settings in browser`
    : `${emjs.warning} Notifications are available only as you install app on your home screen`;
    if (value == 3) {
      qs('#install').style.display = 'block';
      qs('#install').onclick = async () => {
        if (!globals.installPrompt) return;
        await installApp(globals);
        const actualSession = await globals.db.getItem('settings', 'session');
        const actualValue = getNotifPerm(actualSession);
        setNotifTogglerState(null, actualValue);
        toggleNotifReason(actualSession, actualValue, globals);
      };
    }
  } else {
    qs('#notifReason').innerHTML = 'Set what about notifications you will get';
    qs('#install').style.display = 'none';
    if (!qs('#notifTopics').children.length) fillNotifTopics(globals, value);
  }
}

export async function fillNotifTopics(globals, enabled) {
  const session = await globals.db.getItem('settings', 'session');
  const notifications = await globals.db.getItem('settings', 'notifications');
  if (!enabled && enabled !== 0) {
    enabled = notifications.enabled ? 1 : 0;
  }
  const value = getNotifPerm(session, null, enabled);
  if (isBadValue(value)) return;
  const notifTopics = qs('#notifTopics');
  notifTopics.innerHTML = '';
  const list = await globals.getList('notifications');
  for (let item of list) {
    const firstValue = notifications.byCategories[item.name] ? 1 : 0;
    renderToggler({
      name: item.title, id: 'notifTopic', buttons: [{
        emoji: emjs[firstValue ? 'sign' : 'blank'],
        func: async ({e, elem}) => {
          const value = toggleFunc({e, elem});
          await globals.db.updateItem('settings', 'notifications', (data) => {
            data.byCategories[item.name] = value ? true : false;
          });
        }
      }], page: notifTopics, value: firstValue, disabled: !enabled
    });
  }
}

function setNotifTogglerState(elem, value) {
  if (!elem) elem = qs('[data-id="notifications"]');
  elem.dataset.value = value;
  elem.querySelector('button').innerHTML = getEmoji(null, null, null, value);
}

async function onNotifTogglerClick({e, elem, globals}) {
  const session = await globals.db.getItem('settings', 'session');
  const target = e.target.dataset.action ? e.target : e.target.parentElement;
  if (!session.installed) {
    setNotifTogglerState(elem, 3);
    return globals.message({
      state: 'success', text: 'Install dailer on your home screen to unlock notifications'
    });
  }
  if (Notification.permission == 'denied') {
    setNotifTogglerState(elem, 2);
    return globals.message({
      state: 'fail', text: 'Enable notifications via site settings in browser'
    });
  }
  if (Notification.permission == 'default') {
    target.innerHTML = emjs.loading;
    target.setAttribute('disabled', '');
    await requestNotifications(globals);
    return target.removeAttribute('disabled');
  }
  const value = toggleFunc({e, elem});
  await globals.db.updateItem('settings', 'notifications', (data) => {
    data.enabled = value ? true : false;
  });
  updateNotifTopics(!value);
}

export async function requestNotifications(globals) {
  const resp = await Notification.requestPermission();
  const data = await globals.db.updateItem('settings', 'notifications', (data) => {
    data.permission = resp;
    data.enabled = resp == 'granted' ? true : false;
    if (data.enabled) data.grantedAt.push(Date.now());
  });
  if (data.enabled) {
    await registerPeriodicSync();
    globals.message({ state: 'success', text: 'Notifications are enabled!' });
  } else {
    globals.message({
      state: 'fail', text: 'You denied in permission. Grant it via site settings in browser to enable notifications'
    });
  }
  const session = await globals.db.getItem('settings', 'session');
  const value = getNotifPerm(session, resp, data.enabled);
  const elem = qs('[data-id="notifications"]');
  elem.dataset.value = value;
  elem.querySelector('button').innerHTML = getEmoji(null, null, null, value);
  toggleNotifReason(session, value, globals);
  updateNotifTopics(!value);
  return value;
}

function updateNotifTopics(disabled) {
  for (let elem of qsa('[data-id="notifTopic"]')) {
    elem
      .querySelector('button')
      [disabled ? 'setAttribute' : 'removeAttribute']
      ('disabled', '');
  }
}

export async function registerPeriodicSync(reg) {
  const status = await navigator.permissions.query({
    name: 'periodic-background-sync',
  });
  const resp = status.state;
  if (status.state !== 'granted') return resp;
  try {
    if (!reg) reg = await navigator.serviceWorker.getRegistration();
    await reg.periodicSync.register('dailyNotification', {
      minInterval: oneDay
    });
  } catch (err) {}
  return resp;
}
