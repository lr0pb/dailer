import {
  database, IDB,
  getRawDate, isUnder3AM, oneDay, normalizeDate, getToday, isCustomPeriod,
  intlDate, getTextDate, setPeriodTitle
} from './defaultFunctions.js'

let periods = null;
let session = null;

export async function updatePeriods(ifNotExist) {
  if (ifNotExist && periods) return;
  periods = {};
  await db.getAll('periods', (per) => { periods[per.id] = per; });
}

export async function createDay(today = getToday()) {
  await updatePeriods(true);
  if (!session) session = await db.getItem('settings', 'session');
  if (!session.firstDayEver) session.firstDayEver = today;
  const check = await checkLastDay(today);
  let tasks = null;
  let previousDay = null;
  if (!check.check) {
    const resp = await createDay(check.dayBefore);
    tasks = resp.tasks;
    await afterDayEnded(resp.day);
  }
  let day = await db.getItem('days', today.toString());
  if (!day) {
    const updateList = session.updateTasksList.map((taskId) => new Promise((res) => {
      db.updateItem('tasks', taskId, setPeriodTitle).then(res);
    }));
    await Promise.all(updateList);
    session.updateTasksList = [];
  }
  const cleared = day ? day.cleared : null;
  if (!day || day.lastTasksChange !== session.lastTasksChange) {
    day = getRawDay(today, !day);
  } else return isEmpty(day) ? { day: 'error' } : { day };
  if (cleared) day.cleared = cleared;
  if (!tasks) {
    tasks = [];
    await db.getAll('tasks', (task) => {
      if (task.disabled || task.deleted ? false : true) tasks.push(task);
    });
  }
  const addTask = (task, value) => {
    day.tasks[task.priority][task.id] = value;
    day.tasksAmount++;
  };
  for (let task of tasks) {
    if (task.wishlist) continue;
    if (task.periodStart <= today) {
      if (day.firstCreation || !task.history.length) {
        updateTask(task);
        if (task.period[task.periodDay]) {
          task.history.push(0);
          addTask(task, 0);
          if (task.special && task.special == 'untilComplete') day.cleared = false;
        }
        await db.setItem('tasks', task);
      } else if (task.period[task.periodDay]) {
        addTask(task, task.history.at(-1));
      }
    }
  }
  await db.setItem('days', day);
  await db.setItem('settings', session);
  return day.tasksAmount === 0 ? { day: 'error', tasks } : { day, tasks };
}

export function getRawDay(date, firstCreation) {
  return {
    date: String(date), tasks: [{}, {}, {}], // 3 objects for 3 priorities
    completed: false, lastTasksChange: session.lastTasksChange,
    firstCreation, cleared: true, tasksAmount: 0, completedTasks: 0,
    afterDayEndedProccessed: false
  };
}

async function checkLastDay(day) {
  const dayBefore = day - oneDay;
  const check = session.firstDayEver == day
  ? true
  : await db.getItem('days', dayBefore.toString());
  return { check, dayBefore };
}

export function setDefaultPeriodTitle(task) {
  task.periodTitle = isCustomPeriod(task.periodId)
  ? ''
  : (task.periodId && periods[task.periodId].title) || task.ogTitle || task.periodTitle;
}

export function disable(task) {
  task.periodDay = -1;
  task.disabled = true;
  session.updateTasksList.push(task.id);
  setPeriodTitle(task);
}

function updateTask(task) {
  if (task.special == 'oneTime') {
    if (task.history.length == task.period.length) {
      disable(task);
    } else if (getToday() == task.periodStart) {
      task.periodDay = 0;
      setDefaultPeriodTitle(task, periods);
      setPeriodTitle(task);
    } else {
      task.periodDay++;
    }
    return;
  } else if (task.special == 'untilComplete') {
    if (task.history[0] == 1) {
      task.endDate = getToday() - oneDay; disable(task);
    } else {
      task.periodDay = 0; task.history.length = 0;
      setPeriodTitle(task);
    }
    return;
  }
  setDefaultPeriodTitle(task, periods);
  if (task.endDate && task.endDate == getToday()) {
    disable(task);
  }
  task.periodDay++;
  if (task.periodDay == task.period.length) {
    task.periodDay = 0;
  }
}
function isEmpty(day) {
  for (let tasks of day.tasks) {
    if (Object.keys(tasks).length > 0) return false;
  }
  return true;
}
/**
* @onTask(id, value, priority) - async function calls for every task in day
*/
async function enumerateDay(day, onTask) {
  if (!day.tasks) return;
  for (let i = day.tasks.length - 1; i > -1; i--) {
    const priority = day.tasks[i];
    for (let taskId in priority) {
      await onTask(taskId, priority[taskId], i);
    }
  }
}

export async function afterDayEnded(day) {
  if (day.afterDayEndedProccessed) return;
  let completedTasks = 0;
  let tasksAmount = 0;
  const forgottenTasks = [];
  const tasksToDelete = [];
  await enumerateDay(day, async (id, value, priority) => {
    tasksAmount++;
    let pushToForgotten = false;
    if (value === 1) completedTasks++;
    else pushToForgotten = true;
    if (!day.cleared) {
      const task = await db.getItem('tasks', id);
      if (task.special && task.special == 'untilComplete' && value === 0) {
        tasksToDelete.push({ priority, id });
        pushToForgotten = false;
      }
    }
    if (pushToForgotten) forgottenTasks.push(id);
  });
  for (let adress of tasksToDelete) {
    delete day.tasks[adress.priority][adress.id];
  }
  tasksAmount -= tasksToDelete.length;
  day.cleared = true;
  day.tasksAmount = tasksAmount;
  day.completedTasks = completedTasks;
  day.afterDayEndedProccessed = true;
  await db.setItem('days', day);
  return forgottenTasks;
}

export async function getYesterdayRecap() {
  const session = await db.getItem('settings', 'session');
  if (session.recaped == getToday()) return {
    response: { recaped: true }
  };
  const noShowResp = { response: { show: false } };
  const date = getToday() - oneDay;
  let day = await db.getItem('days', String(date));
  if (!day) {
    const resp = await createDay(date);
    if (resp.day == 'error') return noShowResp;
    day = resp.day;
  }
  let forgottenTasks = null;
  if (day.forgottenTasks) forgottenTasks = day.forgottenTasks;
  if (!day.tasksAmount) day.afterDayEndedProccessed = false;
  if (!day.forgottenTasks || !day.tasksAmount || !day.afterDayEndedProccessed) {
    forgottenTasks = await afterDayEnded(day);
    if (!forgottenTasks) return noShowResp;
    day.forgottenTasks = forgottenTasks;
    await db.setItem('days', day);
  }
  if (day.tasksAmount === 0) return noShowResp;
  const response = {
    show: true, completed: false, count: day.completedTasks, all: day.tasksAmount
  };
  if (day.completedTasks == day.tasksAmount) {
    day.completed = true;
    response.completed = true;
    await db.setItem('days', day);
  }
  return { response, day };
}

export async function checkBackupReminder() {
  const remind = await db.getItem('settings', 'backupReminder');
  const resp = { show: false };
  if (!remind.value) return resp;
  if (remind.nextRemind === getToday() && remind.isDownloaded) return resp;
  while (remind.nextRemind < getToday()) {
    remind.nextRemind += remind.value;
  }
  remind.isDownloaded = false;
  if (remind.nextRemind === getToday()) resp.show = true;
  await db.setItem('settings', remind);
  return resp;
};
