import {
  getToday, oneDay, normalizeDate, getTextDate, isCustomPeriod
} from './periods.js'
import { taskHistory } from './taskHistory.js'
import { reloadApp } from '../../utils/appState.js'
import { renderToggler, toggleFunc } from '../../ui/toggler.js'

/**
 * @callback completeCallback Calls after task complete button clicked
 * @param {Day} day Day object
 * @param {1 | 0} value Task complete state
 */
export function renderTask(globals, task, page, {
  completeTask, editTask: edit, deleteTask, openTask, extendedInfo: ei,
  customDay, completeCallback, customButtons
}) {
  let body = null;
  if (ei && typeof ei == 'object' && ei.periods && ei.priorities) {
    const priority = ei.priorities[task.priority];
    const emoji = priority.emoji ? emjs[priority.emoji] : '';
    body = `
      <h3>${task.name}</h3>
      <p>${isCustomPeriod(task.periodId)
        ? `<span class="customTitle" data-period="${task.periodId}">${
          ei.periods[task.periodId].title
        }</span>${task.periodTitle}` : task.periodTitle
      } | ${emoji}${priority.title}</p>
    `;
  }
  const markTitle = (taskName) => `Mark task${taskName ? ` '${taskName}'` : ''} as completed`;
  const buttons = [];
  if (edit) buttons.push({
    emoji: emjs.pen, title: 'Edit task', aria: `Edit task: ${task.name}`,
    func: onTaskEditClick, args: { globals }
  });
  if (deleteTask) buttons.push({
    emoji: emjs.trashCan, title: 'Delete task', aria: `Delete task: ${task.name}`,
    func: onTaskDeleteClick, args: { globals }
  });
  if (completeTask) buttons.push({
    emoji: emjs[taskHistory.getLastValue(task) ? 'sign' : 'blank'],
    title: markTitle(), aria: markTitle(task.name),
    func: onTaskCompleteClick, args: { globals, customDay, completeCallback }
  });
  if (customButtons && Array.isArray(customButtons)) buttons.push(
    ...customButtons
  );
  return renderToggler({
    name: task.name, id: task.id, body, buttons, page,
    value: completeTask ? taskHistory.getLastValue(task) : null,
    onBodyClick: openTask ? openTaskInfo : null, args: { globals }
  });
}

function onTaskEditClick({elem, globals}) {
  const id = elem.dataset.id;
  globals.pageInfo = { taskAction: 'edit', taskId: id };
  globals.paintPage('taskCreator', { params: { id } });
}

async function onTaskDeleteClick({elem, globals}) {
  await editTask({
    globals, id: elem.dataset.id, field: 'deleted', onConfirm: () => {
      const page = elem.parentElement;
      elem.remove();
      if (!page.children.length) showNoTasks(page);
    }
  });
}

async function openTaskInfo({elem, globals}) {
  const id = elem.dataset.id;
  if (!globals.pageInfo) globals.pageInfo = {};
  globals.pageInfo = { taskId: id };
  await globals.paintPage('taskInfo', { params: { id } });
}

async function onTaskCompleteClick({
  e, elem, globals, customDay, completeCallback
}) {
  const td = await globals.db.get('tasks', elem.dataset.id);
  const date = customDay ? customDay : getToday().toString();
  const day = await globals.db.get('days', date);
  if (!day) return globals.floatingMsg({
    text: `${emjs.alarmClock} Day is expired! So you need to reload tasks for today`,
    onClick: async () => await reloadApp(globals),
    button: 'Reload', longButton: `${emjs.reload} Reload app`,
    pageName: 'main'
  });
  const value = toggleFunc({e, elem});
  taskHistory.updateValue(td, value);
  day.tasks[td.special || 'regular'][td.priority][td.id] = value;
  day.afterDayEndedProccessed = false;
  await globals.db.set('tasks', td);
  await globals.db.set('days', day);
  if (completeCallback) await completeCallback(day, value);
}

export function showNoTasks(page) {
  page.classList.add('center');
  const isArchive = page.parentElement.id == 'tasksArchive';
  page.innerHTML = `
    <h2 class="emoji">${isArchive ? emjs.book : emjs.empty}</h2>
    <h2>${isArchive
    ? 'When tasks become expired or disabled, they will be shown here'
    : 'There are no active tasks in the moment!'}</h2>
  `;
}

export async function editTask({globals, id, field, onConfirm}) {
  const td = await globals.db.get('tasks', id);
  globals.openPopup({
    text: `Do you really want to ${field.replace(/\w$/, '')} this task?`,
    emoji: emjs[field == 'deleted' ? 'trashCan' : 'disabled'],
    action: async () => {
      td[field] = true;
      if (!td.endDate || !td.special) td.endDate = getToday() + oneDay;
      await globals.db.set('tasks', td);
      await globals.worker.call({ process: 'disable', args: td.id });
      await globals.db.update('settings', 'session', (session) => {
        session.lastTasksChange = Date.now();
      });
      globals.message({ state: 'success', text: `Task ${field}` });
      if (!globals.pageInfo) globals.pageInfo = {};
      globals.pageInfo.stateChangedTaskId = id;
      onConfirm();
    }
  });
}

export function setPeriodTitle(task) {
  task.periodStart = normalizeDate(task.periodStart);
  const startTitle = getTextDate(task.periodStart);
  const endTitle = task.endDate ? getTextDate(task.endDate - oneDay) : null;

  if (task.special == 'oneTime' && task.period.length == 1) {
    task.periodTitle = `Only ${startTitle}`;
  } else if (task.special == 'untilComplete' && task.endDate) {
    task.periodTitle = `${
      task.disabled && task.endDate < getToday() ? 'Ended' : 'Complete until'
    } ${endTitle}`;
  } else if (task.periodStart > getToday()) {
    task.periodTitle += ` from ${startTitle}`;
  } else if (task.endDate && !task.disabled) {
    task.periodTitle += ` to ${endTitle}`;
  }
}

export function getTaskRestoreInfo(task, isShort) {
  const borderDate = task.special == 'oneTime'
  ? task.periodStart : task.special == 'untilComplete' ? task.endDate - oneDay : null
  const canRestore = !task.special || (borderDate && borderDate >= getToday());
  const restoreNow = !task.special || (task.special && task.disabled);
  const restoreText = `${
    canRestore || isShort ? '' : `${emjs.warning} `
  }${isShort ? '' : `You can`}${canRestore ? '' : 'not'}${isShort ? 'R' : ' r'}estore this task ${
    canRestore ? task.special ? `until ${getTextDate(borderDate)}` : 'later' : ''
  }`;
  return { canRestore: canRestore && restoreNow, restoreText };
}
