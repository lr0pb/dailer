import { getToday, normalizeDate, oneDay, isCustomPeriod } from './highLevel/periods.js'
import { getTextDate } from './highLevel/taskThings.js'
import { qs, hide, getElements } from '../utils/dom.js'
import { syncGlobals } from '../utils/appState.js'

let taskTitle = null;

export const taskInfo = {
  get title() {
    return `${emjs.oldPaper} ${taskTitle ? `Task info: ${taskTitle}` : 'Task info'}`;
  },
  get titleEnding() { return taskTitle ? 'line' : 'text'; },
  dynamicTitle: true,
  get header() { return `${emjs.oldPaper} Task info`},
  get page() { return ``},
  styleClasses: 'doubleColumns',
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="edit" class="success hidedUI">${emjs.pen} Edit task</button>
  `},
  script: renderTaskInfo,
  onPageShow: async ({globals, page}) => {
    syncGlobals(globals);
    if (globals.pageInfo.stateChangedTaskId) qs('#edit').style.display = 'none';
    if (!globals.pageInfo.dataChangedTaskId) return;
    const td = await globals.db.getItem('tasks', globals.pageInfo.taskId);
    const periods = await globals.getPeriods();
    const priorities = await globals.getList('priorities');
    qs('#infoBackground h4').innerHTML = td.name;
    qs('.itemsHolder').innerHTML = '';
    const iha = isHistoryAvailable(td);
    renderItemsHolder({task: td, periods, priorities, iha});
  },
  onSettingsUpdate: ({globals}) => { syncGlobals(globals); },
  onBack: (globals) => {
    if (!globals.pageInfo) return;
    delete globals.pageInfo.taskId;
    delete globals.pageInfo.taskAction;
  }
};

async function renderTaskInfo({globals, page, params}) {
  const { back, edit } = getElements('back', 'edit');
  back.addEventListener('click', () => history.back());
  syncGlobals(globals);
  if (!globals.pageInfo.taskId) globals.pageInfo.taskId = params.id;
  const task = await globals.db.getItem('tasks', globals.pageInfo.taskId);
  if (!task) {
    taskTitle = null;
    page.classList.add('center');
    page.innerHTML = `
      <h2 class="emoji">${emjs.empty}</h2>
      <h2>No such task exists</h2>
    `;
    back.classList.remove('secondary');
    return back.innerHTML = `${emjs.sword} Back to the main page`;
  }
  taskTitle = task.name;
  const periods = await globals.getPeriods();
  const priorities = await globals.getList('priorities');
  if (!(task.disabled || task.deleted)) {
    edit.classList.remove('hidedUI');
    edit.addEventListener('click', () => {
      if (!globals.pageInfo) syncGlobals(globals);
      globals.pageInfo.taskAction = 'edit';
      globals.paintPage('taskCreator', { dontClearParams: true });
    });
  }
  const iha = isHistoryAvailable(task);
  const isa = isStatsAvailable(task);
  page.innerHTML = `
    <div>
      <div id="infoBackground">
        <h4>${task.name}</h4>
      </div>
      <div class="itemsHolder"></div>
    </div>
    <div class="fullHeight">${isa ? `
      <h2>Stats</h2>
      <div id="stats" class="content center">
        <h2 class="emoji">${emjs.sparkles}</h2>
        <h3>Stats for this tasks is available and will be rendering with coming updates to app</h3>
      </div>
      ` : isa === false && !task.disabled ? `
      <h2>Stats</h2>
      <div class="content center">
        <h2 class="emoji">${emjs.empty}</h2>
        <h3>Stats will be available after you run this task for 2 weeks</h3>
      </div>` : ''
    }${!iha ? '' : `
      <h2>History</h2>
      <div id="history" class="hiddenScroll"></div>
    `}</div>
  `;
  renderItemsHolder({task, periods, priorities, iha});
  if (iha) await renderHistory(task, isa);
}

function renderItemsHolder({task, periods, priorities, iha}) {
  const { daysInWeek, periodsInWeek, runnedPeriods } = getPeriodsData(task);
  const showQS = runnedPeriods >= periodsInWeek;

  const rawTitle = periods[task.periodId].title;
  const perTitle = isCustomPeriod(task.periodId)
  ? `<span class="customTitle" data-period="${task.periodId}">${rawTitle}</span>` : rawTitle;
  const startTitle = getTextDate(task.periodStart);
  const endTitle = task.endDate ? getTextDate(task.endDate) : null;
  const periodText = !task.special
    ? `${perTitle} from ${startTitle}${task.endDate ? ` to ${endTitle}` : ''}`
    : (task.endDate
      ? `${perTitle}${task.disabled ? `. Ended${
        task.special == 'untilComplete' ? ` in ${(task.endDate - task.periodStart) / oneDay} days on` : ''
      }` : ' to'} ${endTitle}` : task.periodTitle);
  createInfoRect(emjs.calendar, periodText, 'blue', (!iha && !task.disabled) || (iha && showQS) ? 1 : 2);

  const isActive = task.period[task.periodDay];
  const isActiveText = `Today ${isActive ? 'you should do' : `you haven't`} this task`;
  if (!task.disabled) createInfoRect(
    emjs[isActive ? 'alarmClock' : 'moon'], isActiveText, isActive ? 'green' : 'yellow'
  );

  const priority = priorities[task.priority];
  createInfoRect(emjs[priority.emoji || 'fire'], `Importance: ${priority.title}`, priority.color);

  if (iha && showQS) {
    const quickStats = {
      amount: Math[task.period[task.periodDay] ? 'ceil' : 'floor'](daysInWeek), completed: 0, done: false
    };
    for (let i = 1; i < quickStats.amount + 1; i++) {
      if (task.history.at(-1 * i)) quickStats.completed++;
    }
    if (quickStats.completed == quickStats.amount) quickStats.done = true;
    createInfoRect(
      emjs[quickStats.done ? 'party' : 'chartUp'],
      `In last 7 days you complete task ${quickStats.completed}/${quickStats.amount} times`,
      quickStats.done ? 'green' : 'blue'
    );
  }

  if (iha) return;
  let emoji = emjs.cross, color = 'red';
  if (task.history[0]) emoji = emjs.sign, color = 'green';
  createInfoRect(emoji, `Task ${
    task.history.length && task.disabled ? 'was' : 'is'
  } ${task.history[0] ? '' : 'not '}completed`, color);
}

function createInfoRect(emoji, text, color, coef = 1) {
  const elem = document.createElement('div');
  elem.className = 'infoRect';
  elem.style.setProperty('--color', `var(--${color})`);
  elem.style.setProperty('--coef', coef);
  elem.innerHTML = `
    <h4>${emoji}</h4><h3>${text}</h3>
  `;
  qs('.itemsHolder').append(elem);
}

export function isHistoryAvailable(task) {
  if (task.special && task.period.length == 1) return false;
  if (task.history.length) return true;
  return undefined;
}

function getPeriodsData(task) {
  let activeDays = 0;
  for (let day of task.period) { if (day) activeDays++; }
  const periodsInWeek = 7 / task.period.length;
  return {
    periodsInWeek, daysInWeek: activeDays * periodsInWeek,
    runnedPeriods: task.history.length / activeDays
  };
}

function isStatsAvailable(task) {
  if (!dailerData.experiments) return undefined;
  if (task.special && task.period.length == 1) return undefined;
  const { periodsInWeek, runnedPeriods } = getPeriodsData(task);
  if (runnedPeriods >= periodsInWeek * 2) return true;
  if (task.disabled || task.deleted) return undefined;
  return false;
}

function createMonth(name, month, history) {
  const elem = document.createElement('div');
  elem.dataset.month = month;
  elem.innerHTML = `
    <h3>${name}</h3><div class="historyMonth"></div>
  `;
  history.append(elem);
  return elem.querySelector('.historyMonth');
}

const formatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });

function borderValues(value) {
  value--;
  if (value == -1) return 6;
  if (value == 6) return -1;
  return value;
}

function getWeekendDays(date, month) {
  const weekDay = date.getDay();
  const days = [];
  const firstDayInWeek = date.getTime() - borderValues(weekDay) * oneDay;
  let currentDay = weekDay == 6 ? date : firstDayInWeek - oneDay;
  let phase = weekDay == 6 ? 0 : 1;
  while (new Date(currentDay).getMonth() == month) {
    days.push(currentDay);
    phase = phase == 0 ? 1 : 0;
    const coef = !phase ? 1 : 6;
    currentDay -= oneDay * coef;
  }
  return days;
}

function renderEmptyDays(hm, count) {
  for (let i = 0; i < count; i++) { hm.innerHTML += `<h4> </h4>`; }
}

function init(date, h, hm) {
  const month = date.getMonth();
  if (!hm || hm.parentElement.dataset.month !== String(month)) {
    hm = createMonth(formatter.format(date), month, h);
    const emptyDays = borderValues(date.getDay());
    let rwd = null; // remainingWeekendDays
    if (date.getDate() !== 1) {
      rwd = getWeekendDays(date, month);
      const firstWeekendDay = new Date(rwd.at(-1)).getDay();
      renderEmptyDays(hm, borderValues(firstWeekendDay));
      for (let i = 1; i < rwd.length + 1; i++) {
        const weekendDay = new Date(rwd.at(-1 * i));
        hm.innerHTML += `<h4>${weekendDay.getDate()}</h4>`
        if (weekendDay.getDay() == 0 && i !== rwd.length) renderEmptyDays(hm, 5);
      }
    }
    if (
      (rwd && rwd[0] + oneDay !== date.getTime()) || !rwd
    ) renderEmptyDays(hm, emptyDays);
  }
  return hm;
}

async function renderHistory(task, isa) {
  const h = qs('#history');
  let hm = null;
  const initial = (date, item) => {
    date = new Date(date);
    hm = init(date, h, hm);
    if (item && isa) addToStats(date, item);
  }
  await getHistory({
    task,
    onBlankDay: (date) => {
      initial(date);
      hm.innerHTML += `<h4>${emjs.blank}</h4>`;
    },
    onActiveDay: (date, item) => {
      initial(date, item);
      hm.innerHTML += `<h4>${item ? emjs.sign : emjs.cross}</h4>`;
    }
  });
  qs('#history > div:last-child').scrollIntoView();
  qs('.content > :first-child').scrollIntoView();
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

function addToStats(date, item) {
  //
}
