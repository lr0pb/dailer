import { qs } from '../utils/dom.js'
import { reloadApp } from '../utils/appState.js'
import { isCustomPeriod, intlDate } from './highLevel/periods.js'

export const debugPage = {
  get header() { return `${emjs.construction} Debug page`},
  get page() { return `
    <div id="dataContainer" class="doubleColumns"></div>
    <div class="doubleColumns">
      <div class="content">
        <button id="clear" class="danger noEmoji">Clear your data</button>
        <h3>It actually clears all your data. Make sure you have backup</h3>
      </div>
      <div class="content">
        <!--<button id="toRecap" class="noEmoji">Show recap page</button>
        <h3>Reload app and show Yesterday recap page</h3>-->
        <button id="deleteAll" class="danger noEmoji">Delete all</button>
        <h3>Just delete everything you have ${emjs.salute}</h3>
      </div>
    </div>
  `},
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
  `},
  noSettings: true,
  script: renderPage
};

async function renderPage({globals, page}) {
  qs('#back').addEventListener('click', () => history.back());
  const isPersisted = navigator.storage && navigator.storage.persisted
  ? await navigator.storage.persisted() : 'null';
  const memory = navigator.storage && navigator.storage.estimate
  ? await navigator.storage.estimate() : { quota: 0, usage: 0 };
  if (!memory.usageDetails) memory.usageDetails = { caches: 0, indexedDB: 0 };
  const days = await globals.db.has('days');
  const tasks = await globals.db.has('tasks');
  const periods = await globals.db.has('periods');
  const data = {
    'Is storage persisted': isPersisted.toString(),
    'Notification permission': 'Notification' in window
    ? Notification.permission : 'no data',
    'Theoretical available memory': convertBytes(memory.quota, 'Mb'),
    'Used memory': convertBytes(memory.usage, 'kb'),
    'Used by Cache storage': convertBytes(memory.usageDetails.caches, 'kb'),
    'Used by IndexedDb': convertBytes(memory.usageDetails.indexedDB, 'kb'),
    'Days amount': days,
    'Tasks amount': tasks,
    'Periods amount': periods,
    'Network connection type': navigator.connection
    ? navigator.connection.effectiveType : 'no data',
    'Is online': navigator.onLine,
    'dailerData': JSON.stringify(dailerData)
  };
  const container = qs('#dataContainer');
  for (let title in data) {
    const elem = document.createElement('div');
    elem.className = 'dataLine';
    elem.innerHTML = `<h3>${title}:</h3><p>${data[title]}</p>`;
    container.append(elem);
  }
  qs('#clear').addEventListener('click', async () => {
    await clearDatabase(globals);
    await reloadApp(globals);
  });
  /*qs('#toRecap').addEventListener('click', async () => {
    delete localStorage.recaped;
    await reloadApp(globals);
  });*/
  /*qs('#clearSettings').addEventListener('click', async () => {
    //await globals.db.deleteAll('settings');
    await globals.db.delete('settings', 'notifications');
    await globals.db.update('settings', 'session', (session) => {
      session.onboarded = false;
    });
    await reloadApp(globals, 'onboarding');
  });
  qs('#reloadTasks').addEventListener('click', async () => {
    const tasks = await globals.db.getAll('tasks');
    const days = await globals.db.getAll('days');
    for (const task of tasks) {
      task.history = {};
      const type = task.special || 'regular';
      for (const day of days) {
        for (const priopity of day.tasks[type]) {
          if (Object.keys(priopity).includes(task.id)) {
            // bruh, in this moment i understand that all this was dumb
          }
        }
      }
    }
  });*/
  qs('#deleteAll').addEventListener('click', () => {
    const stores = globals.db.db.objectStoreNames;
    for (let store of stores) {
      globals.db.deleteAll(store);
    }
  });
}

function convertBytes(value, unit) {
  const divisioner = unit == 'Gb'
  ? 1e9 : (unit == 'Mb' ? 1e6 : 1e3);
  return Math.round(value / divisioner) + unit;
}

export async function clearDatabase(globals) {
  const stores = globals.db.db.objectStoreNames;
  for (let store of stores) {
    if (store == 'settings') continue;
    globals.db.deleteAll(store);
  }
  await globals.db.update('settings', 'session', (session) => {
    session.updateTasksList = [];
  });
  await globals.db.update('settings', 'periods', (periodData) => {
    periodData.list = periodData.defaultList;
    periodData.lastId = periodData.defaultLastId;
  });
}
