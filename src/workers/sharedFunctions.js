import {
  env,
  oneDay, getToday, isCustomPeriod,
  setPeriodTitle, getMonthId, getHistory, enumerateDay, taskHistory
} from './defaultFunctions.js'

export async function updatePeriods() {
  env.periods = {};
  await env.db.getAll('periods', (per) => { env.periods[per.id] = per; });
}

export async function createDay(today = getToday(), migration) {
  if (!env.periods) await updatePeriods();
  if (!env.session) env.session = await env.db.get('settings', 'session');
  if (!env.session.firstDayEver) env.session.firstDayEver = today;
  if (!migration && !env.session.isHistoryMigrated) {
    env.session.firstDayEver >= 1664053200000 // 25.09.2022
    ? env.session.isHistoryMigrated = true
    : await migrateHistory();
  }
  let tasks = await processPreviousDays(today, migration);
  let day = await env.db.get('days', today.toString());
  if (!day) await updateDisabledTasks();
  if (migration || !day || day.lastTasksChange !== env.session.lastTasksChange) {
    day = getRawDay(today, !day);
  } else return isEmpty(day) ? { day: 'error' } : { day };
  if (!tasks) tasks = await getActiveTasks();
  const addTask = (task, value) => {
    day.tasks[task.special || 'regular'][task.priority][task.id] = value;
    day.tasksAmount++;
  };
  const monthDay = new Date(today).getDate();
  for (let task of tasks) {
    if (task.wishlist) continue;
    if (task.periodStart > today) continue;
    const untilComplete = task.special == 'untilComplete';
    if (migration) {
      if (untilComplete && today !== task.endDate - oneDay) continue;
      const value = taskHistory.isSupported(task)
      ? task.history[migration.monthId]?.[monthDay - 1] : task.history.run[0];
      if (value !== undefined && [0, 1].includes(value)) addTask(task, value);
    } else if (day.firstCreation || taskHistory.isEmpty(task)) {
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
  if (!migration) await env.db.set('settings', env.session);
  return day.tasksAmount === 0 ? { day: 'error', tasks } : { day, tasks };
}

async function processPreviousDays(today, migration) {
  if (migration) {
    console.log(`migration with ${today}`);
    return migration.tasks;
  }
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
  const check = env.session.firstDayEver == day
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
  if (session.recaped == getToday() || !session.isHistoryMigrated) return {
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

async function migrateHistory() {
  self.postMessage({ event: 'historyMigration', data: 0 });
  const tasks = await env.db.getAll('tasks');
  await Promise.all(
    tasks.map((task) => new Promise(async (res) => {
      migrateTask(task).then(res);
    }))
  );
  await env.db.set('tasks', tasks);
  self.postMessage({ event: 'historyMigration', data: 1 });
  const days = await env.db.getAll('days');
  for (const day of days) {
    const date = Number(day.date);
    await createDay(date, {
      monthId: getMonthId({date}), tasks
    });
  }
  env.session.isHistoryMigrated = true;
  await env.db.set('settings', env.session);
  self.postMessage({ event: 'historyMigration', data: 2 });
}

async function migrateTask(task) {
  if (!taskHistory.isSupported(task)) {
    return task.history = { run: task.history };
  };
  const history = {};
  const setHistoryItem = (date, value = 2) => {
    date = new Date(date);
    const monthId = getMonthId({date});
    if (!history[monthId]) {
      history[monthId] = [];
      taskHistory.fillStart(history, date, monthId);
    }
    history[monthId].push(value);
  };
  await getHistory({
    task, onActiveDay: setHistoryItem, onBlankDay: setHistoryItem
  });
  let streak = 0;
  let i = task.history.length - 1;
  while (task.history[i] === 1) {
    streak++; i--;
  }
  task.history = history;
  task.streak = streak;
  task.maxStreak = streak;
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
