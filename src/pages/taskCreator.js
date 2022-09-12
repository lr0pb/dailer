import { getToday, convertDate, oneDay, getWeekStart, isCustomPeriod } from './highLevel/periods.js'
import { editTask, setPeriodTitle, renderToggler, toggleFunc } from './highLevel/taskThings.js'
import {
  qs, qsa, copyObject, createOptionsList, show, showFlex, hide, getElements, getValue
} from '../utils/dom.js'
import { safeDataInteractions, syncGlobals, updateState } from '../utils/appState.js'

let taskTitle = null;

export const taskCreator = {
  get title() {
    return `${emjs.paperWPen} ${
      taskTitle ? `Edit task: ${taskTitle}` : 'Create new task'
    }`;
  },
  get titleEnding() { return taskTitle ? 'line' : 'text'; },
  dynamicTitle: true,
  styleClasses: 'doubleColumns',
  get header() { return `${emjs.paperWPen} <span id="taskAction">Add</span> task`},
  get page() { return `
    <div>
      <h3 id="nameTitle">Enter task you will control</h3>
      <input type="text" id="name" placeHolder="Task name">
      <h3>How important is this task?</h3>
      <select id="priority" title="Select how important is this task"></select>
      <h3>How you want to perform this task?</h3>
      <select id="period" title="Select how you want to perform this task"></select>
      <h3 id="description" class="hidedUI"></h3>
      <h3 id="startDateTitle" class="hidedUI">When start to perform the task?</h3>
      <select id="startDate" class="hidedUI" title="Select option when start to perform the task">
      </select>
      <h3 id="dateTitle" class="hidedUI"></h3>
      <input type="date" id="date" class="hidedUI">
      <div id="wishlistToggler" class="wishlist"></div>
      <h3 class="wishlist hidedUI">Add more ambitious and long-term tasks to your wishlist</h3>
      <div id="endDateToggler"></div>
      <h3 id="endDateTitle" class="endDate hidedUI">Select day when stop to perform the task</h3>
      <input type="date" id="endDate" class="endDate hidedUI">
      <div id="editButtons">
        <h3>Any of actions below cannot be cancelled</h3>
        <div class="content first stretch">
          <button id="restart">${emjs.reload} Restart task</button>
          <button id="disable" class="secondary">${emjs.disabled} Disable task</button>
          <button id="delete" class="danger">${emjs.trashCan} Delete task</button>
        </div>
      </div>
    </div>
    <div></div>
  `},
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="saveTask" class="success">${emjs.save} Save task</button>
  `},
  script: onTaskCreator,
  onSettingsUpdate: async ({globals}) => {
    syncGlobals(globals);
    const { periods, periodsList } = await getPeriods(globals);
    const period = qs('#period');
    if (globals.pageInfo.taskAction == 'edit') {
      if (period.children.length) return;
      const id = globals.pageInfo.taskId;
      const task = await globals.db.getItem('tasks', id);
      const per = periods[task.periodId];
      const opt = document.createElement('option');
      opt.setAttribute('selected', '');
      opt.innerHTML = per.title || task.ogTitle || task.periodTitle;
      period.append(opt);
      return period.setAttribute('disabled', '');
    }
    createOptionsList(period, periodsList);
    for (let per of periodsList) {
      if (per.id == globals.pageInfo.lastPeriodValue) {
        period.value = per.id;
        break;
      }
    }
    await onPeriodChange({target: period}, globals);
  },
  onBack: (globals) => {
    delete globals.pageInfo.taskId;
    delete globals.pageInfo.taskAction;
  }
};

async function getPeriods(globals) {
  const periods = await globals.getPeriods();
  const periodData = await globals.db.getItem('settings', 'periods');
  const periodsList = [];
  for (let per of periodData.list) {
    if (periods[per]) periodsList.push(periods[per]);
  }
  periodsList.push({ id: '00', title: 'No right period? Click to check others' });
  return { periods, periodsList };
}

async function onTaskCreator({globals, params}) {
  const { back, startDate, period, date } = getElements('back', 'startDate', 'period', 'date');
  back.addEventListener('click', () => history.back());
  const session = await globals.db.getItem('settings', 'session');
  if (!session.firstDayEver) hide(back);
  const priorities = await globals.getList('priorities');
  createOptionsList(qs('#priority'), priorities);
  const startDateOptions = await globals.getList('startDateOptions');
  createOptionsList(startDate, startDateOptions);
  renderToggler({
    name: `${emjs.star} Add to wishlist`, id: 'wishlist',
    page: qs('#wishlistToggler'), value: 0, toggler: emjs.blank, first: true
  });
  renderToggler({
    name: `${emjs.alarmClock} No limit to end date`, id: 'noEndDate',
    buttons: [{
      emoji: emjs.sign, func: ({e, elem}) => {
        const value = toggleFunc({e, elem});
        qsa('.endDate').forEach(value ? hide : show);
      }
    }], page: qs('#endDateToggler'), value: 1, first: true
  });
  if (params.wishlist == 'true') {
    if (!globals.pageInfo) globals.pageInfo = {};
    globals.pageInfo.lastPeriodValue = '09';
    period.setAttribute('disabled', '');
    qs('[data-id="wishlist"]').activate();
    qs('[data-id="wishlist"] button').setAttribute('disabled', '');
  }
  safeDataInteractions(['name', 'priority', 'period', 'startDate', 'date', 'endDate']);
  await taskCreator.onSettingsUpdate({globals});
  period.addEventListener('change', async (e) => await onPeriodChange(e, globals));
  startDate.addEventListener('change', onStartDateChange);
  date.min = convertDate(Date.now());
  date.addEventListener('change', onDateChange);
  syncGlobals(globals);
  taskTitle = null;
  if (params.id) globals.pageInfo.taskId = params.id;
  let isEdit = params.id || globals.pageInfo.taskAction == 'edit';
  let td;
  if (isEdit) {
    td = await globals.db.getItem('tasks', globals.pageInfo.taskId);
    if (!td) isEdit = false;
  }
  if (isEdit) {
    await enterEditTaskMode(globals, td);
    taskTitle = td.name;
  } else {
    qs('#name').focus();
    await checkPeriodPromo(globals);
  }
  qs('#saveTask').addEventListener('click', async () => {
    await onSaveTaskClick(globals, session, td, isEdit);
  });
}

async function checkPeriodPromo(globals) {
  const setKnowTrue = async () => {
    await globals.db.updateItem('settings', 'periods', (data) => {
      data.knowAboutFeature = true;
    });
  };
  if (!dailerData.forcePeriodPromo) {
    const periodData = await globals.db.getItem('settings', 'periods');
    if (periodData.knowAboutFeature) return;
    const tasksCount = await globals.db.hasItem('tasks');
    if (tasksCount < periodData.tasksToShowPromo) return;
    const periodsCount = await globals.db.hasItem('periods');
    if (periodsCount > periodData.standartPeriodsAmount) {
      await setKnowTrue();
      return;
    }
  }
  globals.floatingMsg({
    id: 'periodPromo', pageName: 'taskCreator',
    text: `${emjs.light} You can create your own periods for custom use e.g 'Every friday'`,
    button: 'Try&nbsp;it', longButton: `${emjs.calendar}&nbsp;Create&nbsp;one`,
    onClick: async (e) => {
      globals.openSettings('periods');
      globals.closeSettings();
      if (!globals.pageInfo) globals.pageInfo = {};
      globals.pageInfo.periodPromo = true;
      globals.additionalBack = 1;
      await setKnowTrue();
      await globals.paintPage('periodCreator');
    }
  });
}

async function onSaveTaskClick(globals, session, td, isEdit) {
  const task = await createTask(globals, td);
  if (task == 'error') return globals.message({
    state: 'fail', text: 'Fill all fields'
  });
  qs('#saveTask').setAttribute('disabled', '');
  await globals.db.updateItem('settings', 'session', (session) => {
    session.lastTasksChange = Date.now();
  });
  globals.db.setItem('tasks', task);
  globals.message({ state: 'success', text: isEdit ? 'Task saved' : 'Task added' });
  if (!globals.pageInfo) globals.pageInfo = {};
  globals.pageInfo.dataChangedTaskId = task.id;
  await globals.checkPersist();
  if (!session.firstDayEver) return globals.paintPage('main', { replaceState: true });
  history.back();
}

async function enterEditTaskMode(globals, td) {
  const periods = await globals.getPeriods();
  qs('#taskAction').innerHTML = 'Edit';
  qs('#nameTitle').innerHTML = 'You can change task name only once';
  const { name, date, dateTitle, endDate } = getElements('name', 'date', 'dateTitle', 'endDate');
  name.value = td.name;
  if (td.nameEdited) name.disabled = 'disabled';
  qs('#priority').value = td.priority;
  const per = periods[td.periodId];
  date.value = convertDate(td.periodStart);
  if (td.periodStart > getToday() && per.selectTitle) {
    show(dateTitle, per.selectTitle);
    if (per.maxDate) {
      const maxDate = getToday() + oneDay * per.maxDate;
      date.max = convertDate(maxDate);
    }
    show(date);
  }
  if (td.endDate) {
    qs('[data-id="noEndDate"]').activate();
    endDate.value = convertDate(td.endDate);
  } else if (td.special == 'oneTime') {
    hide('[data-id="noEndDate"]');
  }
  if (td.special == 'untilComplete') {
    if (td.wishlist) qs('[data-id="wishlist"]').activate();
    show('h3.wishlist');
  } else {
    hide('[data-id="wishlist"]');
  }
  endDate.min = convertDate(getToday() + oneDay);
  enableEditButtons(globals, td)
}

function enableEditButtons(globals, td) {
  show('#editButtons');
  if (dailerData.experiments) {
    qs('#restart').addEventListener('click', async () => {
      globals.message({
        state: 'success', text: `Restart is not available at the time`
      });
    });
  } else qs('#restart').remove();
  const onConfirm = () => history.back();
  qs('#disable').addEventListener('click', async () => {
    await editTask({ globals, id: td.id, field: 'disabled', onConfirm });
  });
  qs('#delete').addEventListener('click', async () => {
    await editTask({ globals, id: td.id, field: 'deleted', onConfirm });
  });
}

async function onPeriodChange(event, globals) {
  const periods = await globals.getPeriods();
  const value = event.target.value;
  if (value == '00') return globals.openSettings('periods');
  updateState({lastPeriodValue: value});
  const e = getElements('date', 'dateTitle', 'startDate', 'startDateTitle', 'description');
  e.date.value = '';
  e.date.removeAttribute('max');
  for (let elem in e) { e[elem].style.display = 'none'; }
  const per = periods[value];
  let day = per.getWeekStart ? getWeekStart() : getToday();
  if (per.startDayShift) {
    day += oneDay * per.startDayShift;
    e.date.dataset.hardcoded = 'true';
  } else { e.date.dataset.hardcoded = 'false'; }
  e.date.value = convertDate(day);
  if (per.selectTitle && !per.getWeekStart) {
    show(e.dateTitle, per.selectTitle);
    show(e.startDateTitle);
    show(e.startDate);
    e.startDate.value = '0';
    if (per.maxDate) {
      const maxDate = getToday() + oneDay * per.maxDate;
      e.date.max = convertDate(maxDate);
    }
  }
  if (per.description) show(e.description, per.description);
  if (dailerData.experiments && per.special == 'untilComplete') {
    showFlex('[data-id="wishlist"]')
    qsa('.wishlist').forEach(show);
  } else qsa('.wishlist').forEach(hide);
  if (per.special == 'oneTime') {
    const toggler = qs('[data-id="noEndDate"]');
    if (!Number(toggler.dataset.value)) toggler.activate();
    hide(toggler);
  } else showFlex('[data-id="noEndDate"]');
  onStartDateChange({ target: e.startDate });
  onDateChange({ target: e.date });
}

function onDateChange(e) {
  if (e.target.value == '') return;
  const value = new Date(e.target.value).getTime();
  const endValue = new Date(qs('#endDate').value).getTime();
  const newEnd = value + oneDay;
  qs('#endDate').min = convertDate(newEnd);
  if (endValue <= newEnd) qs('#endDate').value = convertDate(newEnd);
}

function onStartDateChange(e) {
  const { date, dateTitle } = getElements('date', 'dateTitle');
  if (date.dataset.hardcoded == 'true') return;
  const elems = [date, dateTitle];
  elems.forEach(hide);
  if (['0', '2'].includes(e.target.value)) {
    date.value = convertDate(getToday());
  } else {
    const today = getToday();
    const weekDay = new Date(today).getDay();
    date.value = convertDate(weekDay == 0 ? today : today + oneDay * (7 - weekDay));
  }
  if (e.target.value == '2') elems.forEach(show);
}

export async function createTask(globals, td = {}) {
  const isPageExist = qs('#name') ? true : false;
  const e = isPageExist ? getElements('name', 'period', 'priority', 'date', 'endDate') : {};
  const task = await globals.worker.call({ process: 'createTask', args: [{
    id: td.id, td, isPageExist, name: isPageExist ? e.name.value : td.name,
    period: isPageExist ? e.period.value : td.periodId,
    priority: isPageExist ? Number(e.priority.value) : td.priority,
    date: isPageExist ? new Date(e.date.value).getTime() : td.periodStart,
    enableEndDate: isPageExist ? getValue('noEndDate') : td.endDate,
    endDate: isPageExist ? new Date(e.endDate.value).getTime() : td.endDate,
    wishlist: isPageExist ? getValue('wishlist') : td.wishlist,
  }] });
  console.log(task);
  if (task.name == '' || isNaN(task.periodStart)) return 'error';
  return task;
}
