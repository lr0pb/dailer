import { oneDay, normalizeDate, getMonthLastDate } from './periods.js'

/**
* @onTask(id, value, priority) - async function calls for every task in day
*/
export async function enumerateDay(day, onTask) {
  if (!day.tasks) return;
  for (const special in day.tasks) {
    const priorities = day.tasks[special];
    for (let i = priorities.length - 1; i > -1; i--) {
      const priority = priorities[i];
      for (let taskId in priority) {
        await onTask(taskId, priority[taskId], i, special);
      }
    }
  }
}

export const taskHistory = {
  isSupported: isHistorySupported,
  isAvailable: isHistoryAvailable,
  isEmpty: isTaskHistoryEmpty,
  getLastMonth,
  getLastValue,
  addValue: addTaskHistoryValue,
  updateValue: updateTaskHistoryValue,
  init: initTaskHistory,
  fillStart: fillTaskStart,
};

function isHistorySupported(task) {
  return !(task.special && task.period.length == 1);
}

function isHistoryAvailable(task) {
  if (!taskHistory.isSupported(task)) return false;
  if (task.history) {
    const date = new Date(task.periodStart);
    const monthId = getMonthId({date});
    return task.history[monthId].length >= date.getDate();
  }
  return undefined;
}

function isTaskHistoryEmpty(task) {
  const lastMonth = taskHistory.getLastMonth(task);
  if (lastMonth === 'run') {
    return task.history[lastMonth].length === 0;
  }
  const lastValue = taskHistory.getLastValue(task);
  const monthCount = Object.keys(task.history).length;
  return monthCount === 1 && lastValue === 3;
}

function getLastMonth(task) {
  return taskHistory.isSupported(task) ? Object.keys(task.history).at(-1) : 'run';
}

function getLastValue(task) {
  const lastMonth = taskHistory.getLastMonth(task);
  return task.history[lastMonth].at(-1);
}

function addTaskHistoryValue(task, value) {
  let lastMonth = taskHistory.getLastMonth(task);
  if (lastMonth !== 'run') {
    const month = new Date(lastMonth);
    const lastMonthDate = new Date(getMonthLastDate(
      month.getMonth(), month.getFullYear()
    ));
    const monthLength = lastMonthDate.getDate();
    console.log(monthLength);
    console.log(task.history[lastMonth].length);
    if (monthLength <= task.history[lastMonth].length) {
      lastMonth = getMonthId({ date: lastMonthDate.getTime() + oneDay });
      task.history[lastMonth] = [];
    }
  }
  task.history[lastMonth].push(value);
}

function updateTaskHistoryValue(task, value, monthId, day) {
  const lastMonth = monthId || taskHistory.getLastMonth(task);
  const index = day || task.history[lastMonth].length - 1;
  task.history[lastMonth][index] = value;
}

function initTaskHistory(task) {
  taskHistory.isSupported(task)
  ? taskHistory.fillStart(task.history, task.periodStart)
  : task.history.run = [];
}

function fillTaskStart(history, date, monthId) {
  if (typeof date == 'number') date = new Date(date);
  if (!monthId) monthId = getMonthId({date});
  const dayNumber = date.getDate();
  history[monthId] = [];
  if (dayNumber !== 1) {
    for (let i = 1; i < dayNumber; i++) {
      history[monthId].push(3);
    }
  }
}

export function getMonthId({date, month, year}) {
  const useDate = !(month && year);
  if (useDate && typeof date == 'number') date = new Date(date);
  return `${useDate ? date.getFullYear() : year}-${
    useDate ? date.getMonth() + 1 : month
  }`;
}

export function borderValues(value) {
  value--;
  if (value == -1) return 6;
  if (value == 6) return -1;
  return value;
}

export async function getHistory({task, onEmptyDays, onBlankDay, onActiveDay}) {
  const creationDay = normalizeDate(task.created || task.id);
  const startDay = new Date(creationDay > task.periodStart ? creationDay : task.periodStart);
  let day = normalizeDate(startDay);
  const emptyDays = borderValues(startDay.getDay());
  if (onEmptyDays) for (let i = emptyDays; i > 0; i--) {
    onEmptyDays(day - oneDay * i);
  }
  let periodCursor = creationDay > task.periodStart ? new Date(creationDay).getDay() : 0;
  let hardUpdate = false;
  const addValue = () => {
    periodCursor++;
    hardUpdate = false;
    day += oneDay;
    if (periodCursor >= task.period.length) {
      periodCursor = 0;
      hardUpdate = true;
    }
  };
  for (let item of task.history) {
    while (!task.period[periodCursor]) {
      if (onBlankDay) onBlankDay(day);
      addValue();
    }
    await onActiveDay(day, item); addValue();
  }
  periodCursor = borderValues(periodCursor + 1);
  while (periodCursor <= task.periodDay && !hardUpdate && !task.period[task.periodDay]) {
    if (onBlankDay) onBlankDay(day);
    addValue();
  }
}
