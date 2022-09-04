import {
  database, IDB,
  getRawDate, isUnder3AM, oneDay, normalizeDate, getToday, isCustomPeriod,
  intlDate, getTextDate, setPeriodTitle
} from './defaultFunctions.js'
import {
  updatePeriods, createDay, getRawDay, setDefaultPeriodTitle, disable, afterDayEnded,
  getYesterdayRecap, checkBackupReminder
} from './sharedFunctions.js'

db = new IDB(database.name, database.version, database.stores);

self.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  self.postMessage({ error: `From Worker: ${e.reason}` });
})

self.onmessage = async (e) => { // safari never call message event setted via listener
  if (typeof e.data !== 'object') return;
  const d = e.data;
  const { _id } = d;
  if (d.process && d.process in internals) {
    if (!d.args) d.args = [];
    if (!Array.isArray(d.args)) d.args = [d.args];
    const resp = await internals[d.process](...d.args);
    self.postMessage({ _id, data: resp });
  }
};

const internals = {
  backupReminder: checkBackupReminder,
  disable: disableTask,
  createDay, getRawDay, createTask,
  updateSession, updatePeriods,
  getYesterdayRecap, checkNotifications, checkReminderPromo,
};

async function disableTask(taskId) {
  await db.updateItem('tasks', taskId, disable);
  await db.setItem('settings', session);
}

function updateSession(item) { session = item; }

async function checkNotifications() {
  const notifs = await db.getItem('settings', 'notifications');
  let show = false;
  for (let i = 0; i < notifs.showPromoLag.length; i++) {
    if (!notifs.firstPromoDay[i]) notifs.firstPromoDay.push(getToday());
    const lag = (value) => notifs.showPromoLag[value];
    const start = notifs.firstPromoDay[i] + lag(i) * oneDay;
    const end = start + notifs.daysToShowPromo[i] * oneDay;
    if (getToday() >= start && getToday() < end) {
      show = true; break;
    }
    if (!lag(i + 1)) break;
    if (end + lag(i + 1) > getToday()) break;
  }
  await db.setItem('settings', notifs);
  return { show };
}

async function checkReminderPromo() {
  const resp = { show: false };
  const remind = await db.getItem('settings', 'backupReminder');
  if (remind.knowAboutFeature) return resp;
  const session = await db.getItem('settings', 'session');
  if (getToday() < session.firstDayEver + oneDay * remind.dayToStartShowPromo) return resp;
  if (!remind.firstPromoDay) {
    remind.firstPromoDay = getToday();
    await db.setItem('settings', remind);
  }
  if (remind.firstPromoDay + oneDay * remind.daysToShowPromo <= getToday()) return resp;
  resp.show = true;
  return resp;
}

async function createTask({
  id, isPageExist, name, period, priority, date, enableEndDate, endDate, wishlist
}) {
  if (!periods) await updatePeriods();
  const td = id ? await db.getItem('tasks', id) : {};
  const per = periods[period];
  const tdPer = td.periodId ? periods[td.periodId] : {};
  const perId = td.periodId || td.ogTitle || per.id;
  const task = {
    id: td.id || Date.now().toString(),
    name, priority,
    period: td.period || per.days,
    periodId: perId,
    periodTitle: isCustomPeriod(perId) ? '' : tdPer.title || per.title,
    periodStart: td.periodStart && td.periodStart <= getToday()
    ? td.periodStart
    : tdPer.selectTitle || per.selectTitle || per.getWeekStart
    ? date : td.periodStart || date,
    periodDay: td.periodId
    ? td.periodDay
    : (per.getWeekStart
       ? new Date().getDay() - 1
       : per.periodDay),
    history: td.history || [],
    special: td.periodId ? td.special : per.special,
    nameEdited: td.periodId ? td.nameEdited : false,
    disabled: td.disabled || false,
    deleted: false
  };
  if (!task.special) delete task.special;
  if (td.name && task.name != td.name) task.nameEdited = true;
  if (td.created) task.created = td.created;
  if (enableEndDate && endDate) task.endDate = endDate;
  if (task.special == 'untilComplete' && wishlist) task.wishlist = wishlist;
  setPeriodTitle(task);
  return task;
}
