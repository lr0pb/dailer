import {
  env,
  oneDay, getToday, isCustomPeriod,
  setPeriodTitle, enumerateDay, taskHistory
} from './defaultFunctions.js'

export async function updatePeriods() {
  env.periods = {};
  await env.db.getAll('periods', (per) => { env.periods[per.id] = per; });
}

export async function createDay(today = getToday()) {
  if (!env.periods) await updatePeriods();
  if (!env.session) env.session = await env.db.get('settings', 'session');
  if (!env.session.firstDayEver) env.session.firstDayEver = today;

  let tasks = await processPreviousDays(today);
  let day = await env.db.get('days', today.toString());
  if (!day) await updateDisabledTasks();
  if (!day || day.lastTasksChange !== env.session.lastTasksChange) {
    day = getRawDay(today, !day);
  } else return isEmpty(day) ? { day: 'error' } : { day };
  if (!tasks) tasks = await getActiveTasks();
  const addTask = (task, value) => {
    day.tasks[task.special || 'regular'][task.priority][task.id] = value;
    day.tasksAmount++;
  };
  for (let task of tasks) {
    if (task.wishlist) continue;
    if (task.periodStart > today) continue;
    if (day.firstCreation || taskHistory.isEmpty(task)) {
      updateTask(task);
      if (!task.disabled) {
        const value = task.period[task.periodDay] ? 0 : 2;
        taskHistory.addValue(task, value);
        if (!value) addTask(task, value);
      }
      await env.db.set('tasks', task);
    } else if (task.period[task.periodDay]) {
      addTask(task, taskHistory.getLastValue(task));
    }
  }
  console.log(day);
  await env.db.set('days', day);
  return day.tasksAmount === 0 ? { day: 'error', tasks } : { day, tasks };
}

async function processPreviousDays(today) {
  const check = await checkLastDay(today);
  if (!check.check) {
    const resp = await createDay(check.dayBefore);
    await afterDayEnded(resp.day);
    await finishDay(resp.day);
    return resp.task;
  }
}

async function checkLastDay(day) {
  day = new Date(day);
  const dayBefore = new Date(
    day.getFullYear(), day.getMonth(), day.getDate() - 1
  ).getTime();
  const check = env.session.firstDayEver == day.getTime()
  ? true
  : await env.db.get('days', dayBefore.toString());
  return { check, dayBefore };
}

async function updateDisabledTasks() {
  const updateList = env.session.updateTasksList.map((taskId) => new Promise((res) => {
    env.db.update('tasks', taskId, setPeriodTitle).then(res);
  }));
  await Promise.all(updateList);
  env.session.updateTasksList = [];
}

export function getRawDay(date, firstCreation) {
  const tasks = {};
  for (const type of ['regular', 'oneTime', 'untilComplete']) {
    tasks[type] = [{}, {}, {}];
  }
  return {
    date: String(date), tasks,
    completed: false, lastTasksChange: env.session.lastTasksChange,
    firstCreation, tasksAmount: 0, completedTasks: 0,
    afterDayEndedProccessed: false
  };
}

function isEmpty(day) {
  for (const special in day.tasks) {
    const priority = day.tasks[special];
    for (const tasks of priority) {
      if (Object.keys(tasks).length > 0) return false;
    }
  }
  return true;
}

async function getActiveTasks() {
  const tasks = [];
  await env.db.getAll('tasks', (task) => {
    if (task.disabled || task.deleted ? false : true) tasks.push(task);
  });
  return tasks;
}

function updateTask(task) {
  if (task.special == 'oneTime') {
    const lastMonth = taskHistory.getLastMonth(task);
    if (task.history[lastMonth].length == task.period.length) {
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
    if (!task.history.run) task.history = { run: task.history };
    if (task.history.run[0] == 1) {
      task.endDate = getToday() - oneDay; disable(task);
    } else {
      task.periodDay = 0; task.history.run.length = 0;
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

export function disable(task) {
  task.periodDay = -1;
  task.disabled = true;
  env.session.updateTasksList.push(task.id);
  setPeriodTitle(task);
}

export function setDefaultPeriodTitle(task) {
  task.periodTitle = isCustomPeriod(task.periodId)
  ? ''
  : (task.periodId && env.periods[task.periodId].title) || task.ogTitle || task.periodTitle;
}

export async function afterDayEnded(day) {
  if (day.afterDayEndedProccessed) return;
  day.tasksAmount = 0;
  day.completedTasks = 0;
  const forgottenTasks = [];
  const completedTasks = [];
  await enumerateDay(day, async (id, value, priority, special) => {
    if (special == 'untilComplete') return;
    day.tasksAmount++;
    if (value === 1) {
      day.completedTasks++;
      if (special == 'regular') completedTasks.push(id);
    } else {
      forgottenTasks.push(id);
    }
  });
  if (completedTasks.length) {
    await env.db.update('tasks', completedTasks, updateTaskStreak);
  }
  day.afterDayEndedProccessed = true;
  day.forgottenTasks = forgottenTasks;
  await env.db.set('days', day);
  return forgottenTasks;
}

function updateTaskStreak(task) {
  task.streak++;
  if (task.streak > task.maxStreak) task.maxStreak = task.streak;
}

export async function finishDay(day) {
  if (day.forgottenTasks?.length) {
    await env.db.update('tasks', day.forgottenTasks, (task) => {
      if (task.special) return;
      const value = taskHistory.getLastValue(task);
      if (value === 1) updateTaskStreak(task);
      else task.streak = 0;
    });
  }
  await env.db.update('days', day.date, (data) => {
    data.afterDayEndedProccessed = true;
    delete data.forgottenTasks;
  });
}

function checkForAchivements(day) {
  //
}

export async function getYesterdayRecap() {
  const session = await env.db.get('settings', 'session');
  if (session.recaped == getToday()) return {
    response: { recaped: true }
  };
  const noShowResp = { response: { show: false } };
  const date = getToday() - oneDay;
  let day = await env.db.get('days', String(date));
  if (!day) {
    const resp = await createDay(date);
    if (resp.day == 'error') return noShowResp;
    day = resp.day;
  }
  let forgottenTasks = null;
  if (day.forgottenTasks) forgottenTasks = day.forgottenTasks;
  if (!day.forgottenTasks || !day.tasksAmount || !day.afterDayEndedProccessed) {
    forgottenTasks = await afterDayEnded(day);
    if (!forgottenTasks) return noShowResp;
    day.forgottenTasks = forgottenTasks;
    await env.db.set('days', day);
  }
  if (day.tasksAmount === 0) return noShowResp;
  const response = {
    show: true, completed: false, count: day.completedTasks, all: day.tasksAmount
  };
  if (day.completedTasks == day.tasksAmount) {
    day.completed = true;
    response.completed = true;
    await env.db.set('days', day);
  }
  return { response, day };
}

export async function checkBackupReminder() {
  const remind = await env.db.get('settings', 'backupReminder');
  const resp = { show: false };
  if (!remind.value) return resp;
  if (remind.nextRemind === getToday() && remind.isDownloaded) return resp;
  while (remind.nextRemind < getToday()) {
    remind.nextRemind += remind.value;
  }
  remind.isDownloaded = false;
  if (remind.nextRemind === getToday()) resp.show = true;
  await env.db.set('settings', remind);
  if (remind.lastTimeDownloaded + oneDay * remind.daysToShowPopup <= getToday()) {
    resp.popup = true;
  }
  return resp;
};
