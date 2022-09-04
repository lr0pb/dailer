import { database } from '../../logic/IDB.js'
import { globQs as qs, globQsa as qsa } from './utils.js'

export async function processSettings(globals, periodicSync) {
  const session = await globals.db.getItem('settings', 'session');
  if (session) dailerData.experiments = session.experiments;
  await Promise.all([
    setPeriods(globals),
    addNotifications(globals),
    addPeriodicSync(globals, periodicSync),
    addPersistentStorage(globals),
    addBackupReminder(globals),
    addSession(globals),
    addPeriodsSettings(globals)
  ]);
  await globals.db.onDataUpdate('settings', async (store, item) => {
    if (item.name !== 'session') return;
    await globals.worker.call({ process: 'updateSession', args: item });
  });
  await globals.db.onDataUpdate('periods', async (store, item) => {
    await globals.worker.call({ process: 'updatePeriods' });
  });
}

export function toggleExperiments() {
  if (dailerData.experiments) {
    //document.documentElement.classList.add('compress');
    const color = getComputedStyle(document.documentElement).accentColor;
    for (let elem of qsa('meta[name="theme-color"]')) {
      elem.content = color;
    }
  } else {
    //document.documentElement.classList.remove('compress');
    const metas = qsa('meta[name="theme-color"]');
    metas[0].content = '#f2f2f2';
    metas[1].content = '#000000';
  }
}

async function setPeriods(globals) {
  await globals._setCacheConfig();
  const periods = globals._cachedConfigFile.periods;
  for (let perId in periods) {
    await globals.db.setItem('periods', periods[perId]);
  }
}

async function checkRecord(globals, recordName, updateFields, onVersionUpgrade) {
  const data = await globals.db.getItem('settings', recordName);
  let shouldUpdateRecord = false;
  if (data && updateFields && typeof updateFields == 'object') {
    Object.assign(data, updateFields);
    shouldUpdateRecord = true;
  }
  if (data && data.version !== database.settings[recordName] && onVersionUpgrade) {
    onVersionUpgrade(data);
    data.version = database.settings[recordName];
    shouldUpdateRecord = true;
  }
  if (shouldUpdateRecord) await globals.db.setItem('settings', data);
  return data ? true : false;
}

async function addNotifications(globals) {
  const isSupported = 'Notification' in window;
  const updateFields = {
    support: isSupported, permission: isSupported ? Notification.permission : null,
  };
  const byCategories = {};
  const list = await globals.getList('notifications');
  for (let categorie of list) {
    byCategories[categorie.name] = categorie.enabled;
  }
  const resp = await checkRecord(globals, 'notifications', updateFields, (data) => {
    Object.assign(byCategories, data.byCategories);
  });
  if (resp) return;
  await globals.db.setItem('settings', {
    name: 'notifications',
    support: isSupported,
    permission: isSupported ? Notification.permission : null,
    enabled: false, byCategories,
    grantedAt: [],
    firstPromoDay: [],
    showPromoLag: [0, 10, 45],
    daysToShowPromo: [2, 3, 5],
    callsHistory: {},
    version: database.settings.notifications
  });
}

async function addPeriodicSync(globals, periodicSync) {
  const isSupported = periodicSync.support;
  const resp = await checkRecord(globals, 'periodicSync', periodicSync);
  if (resp) return;
  await globals.db.setItem('settings', {
    name: 'periodicSync',
    support: isSupported,
    permission: isSupported ? periodicSync.permission : null,
    callsHistory: [],
    version: database.settings.periodicSync
  });
}

async function addPersistentStorage(globals) {
  const isSupported = ('storage' in navigator) && ('persist' in navigator.storage);
  const resp = await checkRecord(globals, 'persistentStorage', { support: isSupported });
  if (resp) return;
  const isPersisted = await navigator.storage.persisted();
  await globals.db.setItem('settings', {
    name: 'persistentStorage',
    support: isSupported,
    isPersisted,
    attempts: localStorage.persistAttempts ? Number(localStorage.persistAttempts) : 0,
    grantedAt: localStorage.persistGranted ? Number(localStorage.persistGranted) : null,
    version: database.settings.persistentStorage
  });
}

async function addBackupReminder(globals) {
  const resp = await checkRecord(globals, 'backupReminder', null, (data) => {
    if (data.version === 1) {
      data.id = data.remindId;
      data.value = data.remindValue;
      data.isDownloaded = data.reminded;
      delete data.remindId; delete data.remindValue; delete data.reminded;
      data.knowAboutFeature = data.id ? true : false;
      data.firstPromoDay = null;
      data.daysToShowPromo = 4;
    } else data.dayToStartShowPromo = 17;
  });
  if (resp) return;
  await globals.db.setItem('settings', {
    name: 'backupReminder',
    id: localStorage.remindId ? localStorage.remindId : null,
    value: localStorage.remindValue ? Number(localStorage.remindValue) : null,
    isDownloaded: localStorage.reminded ? (localStorage.reminded == 'true' ? true : false) : false,
    nextRemind: localStorage.nextRemind ? Number(localStorage.nextRemind) : null,
    knowAboutFeature: localStorage.remindId ? true : false,
    dayToStartShowPromo: 17,
    firstPromoDay: null,
    daysToShowPromo: 4,
    version: database.settings.backupReminder
  });
}

async function addSession(globals) {
  const resp = await checkRecord(globals, 'session');
  if (resp) {
    if (
      window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
    ) await globals.db.updateItem('settings', 'session', (session) => {
      session.installed = true;
    });
    return;
  }
  await globals.db.setItem('settings', {
    name: 'session',
    firstDayEver: localStorage.firstDayEver ? Number(localStorage.firstDayEver) : null,
    lastTasksChange: localStorage.lastTasksChange ? Number(localStorage.lastTasksChange) : null,
    onboarded: localStorage.onboarded ? (localStorage.onboarded == 'true' ? true : false) : false,
    installed: localStorage.installed ? (localStorage.installed == 'true' ? true : false) : false,
    recaped: localStorage.recaped ? Number(localStorage.recaped) : 0,
    updateTasksList: localStorage.updateTasksList ? JSON.parse(localStorage.updateTasksList) : [],
    experiments: localStorage.experiments ? Number(localStorage.experiments) : 0,
    version: database.settings.session
  });
}

async function addPeriodsSettings(globals) {
  const resp = await checkRecord(globals, 'periods');
  if (resp) return;
  const defaultList = ['01', '03', '07', '09'];
  const defaultLastId = 50;
  const periodsCount = await globals.db.hasItem('periods');
  const standartCount = 9;
  let list = null, lastId = null;
  await globals.db.updateItem('settings', 'session', (session) => {
    if (!session.periodsList || !session.lastPeriodId) return;
    list = session.periodsList;
    lastId = session.lastPeriodId;
    delete session.periodsList;
    delete session.lastPeriodId;
    delete session.defaultLastPeriodId;
  });
  await globals.db.setItem('settings', {
    name: 'periods',
    defaultList, defaultLastId,
    list: list || localStorage.periodsList ? JSON.parse(localStorage.periodsList) : defaultList,
    lastId: lastId || localStorage.lastPeriodId ? Number(localStorage.lastPeriodId) : defaultLastId,
    standartPeriodsAmount: standartCount,
    tasksToShowPromo: 3,
    knowAboutFeature: periodsCount > standartCount ? true : false,
    version: database.settings.periods
  });
}
