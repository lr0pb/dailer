import {
  env, database, IDB,
  getRawDate, isUnder3AM, oneDay, normalizeDate, getToday, isCustomPeriod,
  intlDate, getTextDate, setPeriodTitle
} from './defaultFunctions.js'

export async function updatePeriods() {
  env.periods = {};
  await env.db.getAll('periods', (per) => { env.periods[per.id] = per; });
}

export async function createDay(today = getToday()) {
  if (!env.periods) await updatePeriods();
  if (!env.session) env.session = await env.db.getItem('settings', 'session');
  if (!env.session.firstDayEver) env.session.firstDayEver = today;
  const check = await checkLastDay(today);
  let tasks = null;
  let previousDay = null;
  if (!check.check) {
    const resp = await createDay(check.dayBefore);
    tasks = resp.tasks;
    await afterDayEnded(resp.day);
  }
  let day = await env.db.getItem('days', today.toString());
  if (!day) {
    const updateList = env.session.updateTasksList.map((taskId) => new Promise((res) => {
      env.db.updateItem('tasks', taskId, setPeriodTitle).then(res);
    }));
    await Promise.all(updateList);
    env.session.updateTasksList = [];
  }
  const cleared = day ? day.cleared : null;
  if (!day || day.lastTasksChange !== env.session.lastTasksChange) {
    day = getRawDay(today, !day);
  } else return isEmpty(day) ? { day: 'error' } : { day };
  if (cleared !== null) day.cleared = cleared;
  if (!tasks) {
    tasks = [];
    await env.db.getAll('tasks', (task) => {
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
        await env.db.setItem('tasks', task);
      } else if (task.period[task.periodDay]) {
        addTask(task, task.history.at(-1));
      }
    }
  }
  await env.db.setItem('days', day);
  await env.db.setItem('settings', env.session);
  return day.tasksAmount === 0 ? { day: 'error', tasks } : { day, tasks };
}

export function getRawDay(date, firstCreation) {
  return {
    date: String(date), tasks: [{}, {}, {}], // 3 objects for 3 priorities
    completed: false, lastTasksChange: env.session.lastTasksChange,
    firstCreation, cleared: true, tasksAmount: 0, completedTasks: 0,
    afterDayEndedProccessed: false
  };
}

async function checkLastDay(day) {
  const dayBefore = day - oneDay;
  const check = env.session.firstDayEver == day
  ? true
  : await env.db.getItem('days', dayBefore.toString());
  return { check, dayBefore };
}

export function setDefaultPeriodTitle(task) {
  task.periodTitle = isCustomPeriod(task.periodId)
  ? ''
  : (task.periodId && env.periods[task.periodId].title) || task.ogTitle || task.periodTitle;
}

export function disable(task) {
  task.periodDay = -1;
  task.disabled = true;
  env.session.updateTasksList.push(task.id);
  setPeriodTitle(task);
}

function updateTask(task) {
  if (task.special == 'oneTime') {
    if (task.history.length == task.period.length) {
      disable(task);
    } else if (getToday() == task.periodStart) {
      task.periodDay = 0;
      setDefaultPeriodTitle(task, env.periods);
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
  setDefaultPeriodTitle(task, env.periods);
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
      const task = await env.db.getItem('tasks', id);
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
  await env.db.setItem('days', day);
  return forgottenTasks;
}

export async function getYesterdayRecap() {
  const session = await env.db.getItem('settings', 'session');
  if (session.recaped == getToday()) return {
    response: { recaped: true }
  };
  const noShowResp = { response: { show: false } };
  const date = getToday() - oneDay;
  let day = await env.db.getItem('days', String(date));
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
    await env.db.setItem('days', day);
  }
  if (day.tasksAmount === 0) return noShowResp;
  const response = {
    show: true, completed: false, count: day.completedTasks, all: day.tasksAmount
  };
  if (day.completedTasks == day.tasksAmount) {
    day.completed = true;
    response.completed = true;
    await env.db.setItem('days', day);
  }
  return { response, day };
}

export async function checkBackupReminder() {
  const remind = await env.db.getItem('settings', 'backupReminder');
  const resp = { show: false };
  if (!remind.value) return resp;
  if (remind.nextRemind === getToday() && remind.isDownloaded) return resp;
  while (remind.nextRemind < getToday()) {
    remind.nextRemind += remind.value;
  }
  remind.isDownloaded = false;
  if (remind.nextRemind === getToday()) resp.show = true;
  await env.db.setItem('settings', remind);
  return resp;
};
