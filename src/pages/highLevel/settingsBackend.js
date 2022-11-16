import { database } from '../../logic/IDB.js'
import { globQsa as qsa } from '../../utils/dom.js'

export async function processSettings(globals, periodicSync) {
  const timeLog = performance ? {
    dbLoad: performance.now(),
    setSettings: null,
  } : {};
  await globals.db._isDbReady();
  const session = await globals.db.get('settings', 'session');
  if (session) dailerData.experiments = session.experiments;
  if (performance) {
    timeLog.dbLoad = performance.now() - timeLog.dbLoad;
    timeLog.setSettings = performance.now();
  }
  const methods = [
    addNotifications, addPeriodicSync, addPersistentStorage,
    addBackupReminder, addSession, addPeriodsSettings
  ];
  const dataToSetInDB = [];
  await Promise.all(methods.map((method) => {
    return new Promise(async (res) => {
      const generator = method(globals, periodicSync);
      const checkOptions = await generator.next();
      const resp = await checkRecord(globals, ...checkOptions.value);
      if (resp) return res();
      const settingsData = await generator.next();
      dataToSetInDB.push(settingsData.value);
      res();
    });
  }));
  await setPeriods(globals);
  await globals.db.set('settings', dataToSetInDB);
  await globals.db.onDataUpdate('settings', async ({ item }) => {
    if (item !== 'session') return;
    await globals.worker.call({ process: 'updateSession' });
  });
  await globals.db.onDataUpdate('periods', async () => {
    await globals.worker.call({ process: 'updatePeriods' });
  });
  if (performance) {
    timeLog.setSettings = performance.now() - timeLog.setSettings;
    console.log(timeLog);
  }
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
  const predefinedPeriods = globals._cachedConfigFile.periods;
  const periodsArray = [];
  for (let perId in predefinedPeriods) {
    periodsArray.push(predefinedPeriods[perId]);
  }
  await globals.db.set('periods', periodsArray);
}

async function checkRecord(
  globals, recordName, updateFields, onVersionUpgrade, onRecordExists
) {
  const data = await globals.db.get('settings', recordName);
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
  if (shouldUpdateRecord) await globals.db.set('settings', data);
  if (data && onRecordExists) await onRecordExists();
  return data ? true : false;
}

async function* addNotifications(globals) {
  const isSupported = 'Notification' in window;
  const updateFields = {
    support: isSupported, permission: isSupported ? Notification.permission : null,
  };
  const byCategories = {};
  const list = await globals.getList('notifications');
  for (let category of list) {
    byCategories[category.name] = category.enabled;
  }
  yield [
    'notifications', updateFields, (data) => {
      Object.assign(byCategories, data.byCategories);
    }
  ];
  return {
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
  };
}

async function* addPeriodicSync(globals, periodicSync) {
  const isSupported = periodicSync.support;
  yield ['periodicSync', periodicSync];
  return {
    name: 'periodicSync',
    support: isSupported,
    permission: isSupported ? periodicSync.permission : null,
    callsHistory: [],
    version: database.settings.periodicSync
  };
}

async function* addPersistentStorage() {
  const isSupported = ('storage' in navigator) && ('persist' in navigator.storage);
  yield ['persistentStorage', { support: isSupported }];
  const isPersisted = await navigator.storage.persisted();
  return {
    name: 'persistentStorage',
    support: isSupported,
    isPersisted,
    attempts: localStorage.persistAttempts ? Number(localStorage.persistAttempts) : 0,
    grantedAt: localStorage.persistGranted ? Number(localStorage.persistGranted) : null,
    version: database.settings.persistentStorage
  };
}

async function* addBackupReminder() {
  yield ['backupReminder', null, (data) => {
    if (data.version == 1) {
      data.id = data.remindId;
      data.value = data.remindValue;
      data.isDownloaded = data.reminded;
      delete data.remindId; delete data.remindValue; delete data.reminded;
      data.knowAboutFeature = data.id ? true : false;
      data.firstPromoDay = null;
      data.daysToShowPromo = 4;
    } else if (data.version == 2) {
      data.dayToStartShowPromo = 17;
    } else {
      data.lastTimeDownloaded = 0;
      data.daysToShowPopup = 11;
    }
  }];
  return {
    name: 'backupReminder',
    id: localStorage.remindId ? localStorage.remindId : null,
    value: localStorage.remindValue ? Number(localStorage.remindValue) : null,
    isDownloaded: localStorage.reminded ? (localStorage.reminded == 'true' ? true : false) : false,
    lastTimeDownloaded: 0,
    daysToShowPopup: 11,
    nextRemind: localStorage.nextRemind ? Number(localStorage.nextRemind) : null,
    knowAboutFeature: localStorage.remindId ? true : false,
    dayToStartShowPromo: 17,
    firstPromoDay: null,
    daysToShowPromo: 4,
    version: database.settings.backupReminder
  };
}

async function* addSession(globals) {
  yield ['session', null, (data) => {
    if (data.version == 1) {
      data.emojiLastModified = 0;
    }
  }, async () => {
    if (
      dailerData.isDev || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
    ) await globals.db.update('settings', 'session', (session) => {
      session.installed = true;
    });
  }];
  return {
    name: 'session',
    firstDayEver: localStorage.firstDayEver ? Number(localStorage.firstDayEver) : null,
    lastTasksChange: localStorage.lastTasksChange ? Number(localStorage.lastTasksChange) : null,
    onboarded: localStorage.onboarded ? (localStorage.onboarded == 'true' ? true : false) : false,
    installed: localStorage.installed ? (localStorage.installed == 'true' ? true : false) : false,
    recaped: localStorage.recaped ? Number(localStorage.recaped) : 0,
    updateTasksList: localStorage.updateTasksList ? JSON.parse(localStorage.updateTasksList) : [],
    experiments: localStorage.experiments ? Number(localStorage.experiments) : 0,
    emojiLastModified: 0,
    version: database.settings.session
  };
}

async function* addPeriodsSettings(globals) {
  yield ['periods', { tasksToShowPromo: 100 }];
  const defaultList = ['01', '03', '07', '09'];
  const defaultLastId = 50;
  const periodsCount = await globals.db.has('periods');
  const standartCount = 9;
  let list = null, lastId = null;
  await globals.db.update('settings', 'session', (session) => {
    if (!session.periodsList || !session.lastPeriodId) return;
    list = session.periodsList;
    lastId = session.lastPeriodId;
    delete session.periodsList;
    delete session.lastPeriodId;
    delete session.defaultLastPeriodId;
  });
  return {
    name: 'periods',
    defaultList, defaultLastId,
    list: list || localStorage.periodsList ? JSON.parse(localStorage.periodsList) : defaultList,
    lastId: lastId || localStorage.lastPeriodId ? Number(localStorage.lastPeriodId) : defaultLastId,
    standartPeriodsAmount: standartCount,
    tasksToShowPromo: 100,
    knowAboutFeature: periodsCount > standartCount ? true : false,
    version: database.settings.periods
  };
}
