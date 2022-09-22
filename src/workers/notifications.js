import {
  env, getToday
} from './defaultFunctions.js'
import {
  getYesterdayRecap, checkBackupReminder
} from './sharedFunctions.js'

export async function proccessNotifications(notifs, tag) {
  const isAppAlreadyOpened = await cleaning(notifs, tag);
  if (isAppAlreadyOpened) return;
  const { show: reminder } = await checkBackupReminder();
  const backupReminder = notifs.byCategories.backupReminder && reminder;
  if (notifs.byCategories.tasksForDay) {
    const recap = await getDayRecap(backupReminder);
    if (recap) await showNotification(notifs, 'tasksForDay', recap);
  }
  if (backupReminder) await showNotification(notifs, 'backupReminder', {
    title: `\u{1f4e5} It's time to back up your data`,
    body: `You've set reminders to make backups, so today we made one for you \u{1f4e6}`,
    icon: './icons/downloadBackup.png',
    data: { popup: 'downloadBackup' }
  });
  await env.db.setItem('settings', notifs);
}

export async function cleaning(notifs, tag) {
  const remainingNotifications = await registration.getNotifications();
  for (let notif of remainingNotifications) {
    notif.close();
    notifs.callsHistory[notif.timestamp].clean = Date.now();
  }
  await env.db.setItem('settings', notifs);
  if (tag !== 'dailyNotification') return;
  const allClients = await clients.matchAll({ type: 'window' });
  for (let windowClient of allClients) {
    if (windowClient.focused) return true;
  }
}

export async function showNotification(notifs, type, options) {
  if (!options || (options && !options.title)) return;
  const title = options.title;
  delete options.title;
  const ts = Date.now();
  options = Object.assign({
    //badge: './icons/badge.png',
    timestamp: ts, data: { page: 'main' },
    icon: './icons/apple-touch-icon.png',
  }, options);
  notifs.callsHistory[ts] = { type };
  await registration.showNotification(title, options);
}

export async function getDayRecap(backupReminder) {
  const { response: recap } = await getYesterdayRecap();
  if (recap.recaped) {
    if (backupReminder) return;
    const day = await env.env.db.getItem('days', getToday().toString());
    if (day.tasksAmount === 0) return;
    let body = day.tasks[2].length === 0 ? null : '';
    if (body !== '') return;
    await enumerateDay(day, async (id, value, priority) => {
      if (priority !== 2) return;
      if (value === 1) return;
      const task = await env.db.getItem('tasks', id);
      body += `- ${task.name}\n`;
    });
    body = body.replace(/\n$/, '');
    return { title: `\u{1f5e1} Don't forget about importants!`, body };
  }
  if (!recap.show) return {
    title: '\u{1f4d1} Explore tasks for today',
    body: `You have no tasks yesterday, but its time to add some new ones\nDon't miss the dailer! \u{23f0}`
  };
  const resp = {
    title: '\u{1f4f0} Recap of yesterday',
    body: `${
      recap.completed ? 'Congratulations! \u{1f389} ' : ''
    }You done ${recap.count} out of ${recap.all} tasks${
      !recap.completed
      ? '\nOpen app to mark forgottens and check newly arrived tasks'
      : '\nTry to make a streak?'
    }`,
    icon: './icons/statsUp.png',
    data: { page: 'recap' }
  };
  return resp;
}
