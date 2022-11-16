import { isUnder3AM, getToday } from './highLevel/periods.js'
import { qs } from '../utils/dom.js'
import { installApp } from '../utils/appState.js'
import { renderTask } from './highLevel/taskThings.js'
import { downloadData } from './highLevel/createBackup.js'
import { isNotificationsAvailable, requestNotifications } from './settings/notifications.js'
import { popups } from './popups.js'
import { enumerateDay } from './highLevel/taskHistory.js'

export const main = {
  get header() { return `${emjs.sword} Today's tasks`},
  styleClasses: 'center doubleColumns',
  get page() { return `
    <h2 class="emoji">${emjs.eyes}</h2>
    <h2>Tasks loading...</h2>
  `},
  get footer() { return `
    <button id="toHistory" class="secondary">${emjs.fileBox} History</button>
    <button id="toPlan" class="secondary">${emjs.notes} Edit tasks</button>
  `},
  script: async ({globals, page}) => {
    qs('#toHistory').addEventListener('click', () => globals.paintPage('daysHistory'));
    qs('#toPlan').addEventListener('click', () => globals.paintPage('planCreator'));
    if (dailerData.experiments) {
      globals.pageButton({
        emoji: emjs.star, title: 'Open wishlist', onClick: async () => {
          await globals.paintPage('wishlist');
        }
      });
    } else {
      qs('#toHistory').style.display = 'none';
    }
    await renderDay({globals, page});
  },
  onPageShow: updatePage,
  onSettingsUpdate: updatePage
};

async function updatePage({globals, page}) {
  const day = await globals.db.get('days', getToday().toString());
  const session = await globals.db.get('settings', 'session');
  if (
    !day || day.lastTasksChange != session.lastTasksChange ||
    (globals.pageInfo && globals.pageInfo.backupUploaded)
  ) {
    await renderDay({globals, page});
    delete globals.pageInfo.backupUploaded;
  }
}

async function renderDay({globals, page}) {
  const unregister = globals.worker.listen('historyMigration', (stage) => {
    page.innerHTML = `
      <h2 class="emoji">${emjs.fileBox}${emjs.eyes}</h2>
      <h2>${
        !stage
        ? 'dailer migrate your history data to the new format...'
        : stage == 1 ? 'Tasks was converted...' : 'Days was converted!'
      }</h2>
    `;
  });
  const { day } = await globals.worker.call({ process: 'createDay' });
  unregister();
  if (day == 'error') {
    page.innerHTML = `
      <h2 class="emoji">${emjs.magicBall}</h2>
      <h2>You have no tasks today!</h2>
    `;
    addTaskButton(globals, page, 'one');
    page.classList.add('center');
    await processChecks(globals);
    return;
  }
  page.classList.remove('center');
  page.innerHTML = '';
  await enumerateDay(day, async (id) => {
    const td = await globals.db.get('tasks', id);
    renderTask(globals, td, page, {
      completeTask: true, openTask: true
    });
  });
  if (dailerData.isDoubleColumns) {
    if (!qs('#addTaskButton')) addTaskButton(globals, qs('.footer'), 'task');
  } else {
    addTaskButton(globals, page, 'task', 'transparent');
  }
  await processChecks(globals);
}

function addTaskButton(globals, page, lastWord, customClass) {
  const button = document.createElement('button');
  if (customClass) {
    button.classList.add(customClass);
    button.style.margin = 0;
  }
  button.id = 'addTaskButton';
  button.innerHTML = `${emjs.paperWPen} Add ${lastWord}`;
  button.addEventListener('click', () => globals.paintPage('taskCreator'));
  page.append(button);
}

async function processChecks(globals) {
  const checks = [
    checkDayNote, checkBackupReminder, checkInstall, checkNotifications,
    checkReminderPromo
  ];
  for (let checkFunction of checks) {
    const check = await checkFunction(globals);
    if (check) return;
  }
}

async function checkDayNote(globals) {
  if (!isUnder3AM()) return;
  if (sessionStorage.dayNoteClosed == 'true') return;
  globals.floatingMsg({
    id: 'dayNote',
    text: `${emjs.alarmClock} Tasks for new day will arrive at 3:00 AM`,
    onClick: async (e) => {
      sessionStorage.dayNoteClosed = 'true';
      e.target.parentElement.remove();
      await processChecks(globals);
    },
    button: 'Okay', pageName: 'main'
  });
  return true;
}

export async function checkInstall(globals) {
  if (dailerData.isIOS || dailerData.isMacOS) return;
  if (!globals.installPrompt) return;
  const persist = await globals.checkPersist();
  const session = await globals.db.get('settings', 'session');
  if (persist === false || !session.installed) {
    globals.floatingMsg({
      id: 'install',
      text: `${emjs.crateDown} To protect your data, install dailer on your home screen`,
      button: 'Install', longButton: `${emjs.crateDown}&nbsp;Install&nbsp;dailer`,
      onClick: async (e) => {
        e.target.parentElement.remove();
        await installApp(globals);
      },
      pageName: 'main'
    });
    return true;
  }
}

async function checkBackupReminder(globals) {
  const resp = await globals.worker.call({ process: 'backupReminder' });
  if (!resp.show) return;
  globals.floatingMsg({
    id: 'backupReminder',
    text: `${emjs.bread} Your data has been backed up`,
    button: 'Download', longButton: `${emjs.box}&nbsp;Download&nbsp;backup`,
    pageName: 'main',
    onClick: async (e) => {
      const link = await downloadData(globals);
      link.click();
      await processChecks(globals);
    }
  });
  if (resp.popup) globals.openPopup(popups.downloadBackup(globals));
  return true;
}

async function checkReminderPromo(globals) {
  if (!dailerData.forceReminderPromo) {
    const resp = await globals.worker.call({ process: 'checkReminderPromo' });
    if (!resp.show) return;
  }
  globals.floatingMsg({
    id: 'reminderPromo',
    text: `${emjs.light} Protect your data${
      dailerData.isDoubleColumns ? ' ' : '<br>'
    }by creating backups periodically`,
    button: 'View', longButton: `${emjs.settings}&nbsp;View&nbsp;settings`,
    pageName: 'main',
    onClick: async (e) => {
      await globals.openSettings('manageData');
      e.target.parentElement.remove();
      await globals.db.updateItem('settings', 'backupReminder', (data) => {
        data.knowAboutFeature = true;
      });
    }
  });
  return true;
}

async function checkNotifications(globals) {
  const isSupported = await isNotificationsAvailable(globals);
  if (!isSupported) return;
  if (Notification.permission !== 'default') return;
  const { show } = await globals.worker.call({ process: 'checkNotifications' });
  if (!show) return;
  globals.floatingMsg({
    id: 'notifications',
    text: `${emjs.bell} Get a daily tasks overview through notifications`,
    button: 'Turn&nbsp;on', longButton: `${emjs.alarmClock}&nbsp;Turn&nbsp;it&nbsp;on`,
    pageName: 'main',
    onClick: async (e) => {
      e.target.parentElement.remove();
      await requestNotifications(globals);
      await processChecks(globals);
    }
  });
  return true;
}
