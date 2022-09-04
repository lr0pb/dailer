import {
  qs, /*emjs,*/ intlDate, handleKeyboard, reloadApp, convertEmoji
} from './utils.js'
import { getToday, oneDay, normalizeDate, isCustomPeriod } from './periods.js'

// req - required

export function renderToggler({
  name/*if body present - not req*/, body/*not req, html string*/, id/*req, string*/, buttons = []/*not req*/,
  toggler/*not req*/, value/*if toggler present - req, number 1 | 0*/,
  onBodyClick/*not req, func*/, args = {}/*not req, object*/,
  page/*not req, html elem*/, first/*not req, boolean*/, disabled/*not req, boolean*/
}) {
  // toggler property represents emoji, that will arrive as first toggle value
  // but either this prop gives understand to enable default toggle function
  const elem = document.createElement('div');
  elem.className = `task ${first ? 'first' : ''}`;
  elem.dataset.id = id;
  const noChilds = !page ? true : page.children.length == 0;
  if (onBodyClick) {
    elem.setAttribute('role', 'button');
    elem.tabIndex = dailerData.focusgroup ? (noChilds ? 0 : -1) : 0;
    handleKeyboard(elem, true);
  }
  elem.setAttribute('focusgroup', 'extend horizontal');
  let buttonsString = ``;
  if (toggler) buttons.push({ emoji: toggler, func: toggleFunc });
  buttons.forEach((btn, i) => {
    buttonsString += `
      <button data-action="${i}" class="emojiBtn" ${disabled ? 'disabled' : ''}
        title="${btn.title || 'Toggle value'}" aria-label="${btn.aria || `Toggle ${convertEmoji(name)} value`}"
        tabIndex="${dailerData.focusgroup ? (noChilds && !onBodyClick && i == 0 ? 0 : -1) : 0}"
      >${btn.emoji}</button>
    `;
  });
  elem.innerHTML = `<div>${body || `<h2>${name}</h2>`}</div>${buttonsString}`;
  elem.addEventListener('click', async (e) => {
    const target = e.target.dataset.action
    ? e.target : e.target.parentElement;
    if (target.hasAttribute('disabled')) return;
    if (target.dataset.action) {
      const btn = buttons[target.dataset.action];
      if (!btn.args) btn.args = {};
      await btn.func({...btn.args, e, elem});
    } else if (onBodyClick) {
      await onBodyClick({...args, e, elem});
    }
  });
  if (value !== undefined) elem.dataset.value = value;
  elem.activate = () => elem.querySelector('button').click();
  if (page) page.append(elem);
  return elem;
}

export function toggleFunc({e, elem}) {
  const value = Number(elem.dataset.value) ? 0 : 1;
  elem.dataset.value = value;
  const target = e.target.dataset.action ? e.target : e.target.parentElement;
  target.innerHTML = value ? emjs.sign : emjs.blank;
  return value;
}

export function renderTask({
  type, globals, td, page, periods, priorities, forcedDay, extraFunc, openTask
}) {
  const markTitle = (task) => `Mark task${task ? ` "${task}"` : ''} as completed`;
  if (type == 'day') return renderToggler({
    name: td.name, id: td.id, buttons: [{
      emoji: getTaskComplete(td), title: markTitle(), aria: markTitle(td.name),
      func: onTaskCompleteClick, args: { globals, forcedDay, extraFunc }
    }], page, onBodyClick: openTask ? openTaskInfo : null,
    args: { globals }, value: td.history.at(-1)
  });
  const buttons = [{
    emoji: emjs.pen, title: 'Edit task', aria: `Edit task: ${td.name}`,
    func: onTaskEditClick, args: { globals }
  }, {
    emoji: emjs.trashCan, title: 'Delete task', aria: `Delete task: ${td.name}`,
    func: onTaskDeleteClick, args: { globals, page }
  }];
  const priority = priorities[td.priority];
  const emoji = emjs[priority.emoji || ''];
  return renderToggler({
    body: `
      <h3>${td.name}</h3>
      <p>${isCustomPeriod(td.periodId)
        ? `<span class="customTitle" data-period="${td.periodId}">${
          periods[td.periodId].title
        }</span>${td.periodTitle}` : td.periodTitle
      } | ${emoji}${emoji === '' ? '' : ' '}${priority.title}</p>
    `, id: td.id, buttons: td.disabled ? undefined : buttons,
    page, onBodyClick: openTaskInfo, args: { globals }
  });
}

function onTaskEditClick({elem, globals}) {
  const id = elem.dataset.id;
  globals.pageInfo = { taskAction: 'edit', taskId: id };
  globals.paintPage('taskCreator', { params: { id } });
}

async function onTaskDeleteClick({elem, globals, page}) {
  await editTask({
    globals, id: elem.dataset.id, field: 'deleted', onConfirm: () => {
      elem.remove();
      if (!page.children.length) showNoTasks(page);
    }
  });
}

function openTaskInfo({elem, globals}) {
  const id = elem.dataset.id;
  if (!globals.pageInfo) globals.pageInfo = {};
  globals.pageInfo = { taskId: id };
  globals.paintPage('taskInfo', { params: { id } });
}

export function showNoTasks(page) {
  page.classList.add('center');
  const isArchive = page.parentElement.id == 'tasksArchive';
  page.innerHTML = `
    <h2 class="emoji">${isArchive ? emjs.book : emjs.empty}</h2>
    <h2>${isArchive
    ? 'When tasks expired or you disable them, they will get here'
    : 'There is no tasks right now!'}</h2>
  `;
}

export async function editTask({globals, id, field, onConfirm}) {
  const td = await globals.db.getItem('tasks', id);
  globals.openPopup({
    text: `Are you sure to ${field.replace(/\w$/, '')} this task?`,
    emoji: emjs[field == 'deleted' ? 'trashCan' : 'disabled'],
    action: async () => {
      td[field] = true;
      td.endDate = getToday();
      await globals.db.setItem('tasks', td);
      await globals.worker.call({ process: 'disable', args: td.id });
      await globals.db.updateItem('settings', 'session', (session) => {
        session.lastTasksChange = Date.now();
      });
      globals.message({ state: 'success', text: `Task ${field}` });
      if (!globals.pageInfo) globals.pageInfo = {};
      globals.pageInfo.stateChangedTaskId = id;
      onConfirm();
    }
  });
}

export function getTextDate(date) {
  let resp = intlDate(date);
  if (date == getToday()) resp = 'today';
  else if (date - oneDay == getToday()) resp = 'tomorrow';
  else if (date + oneDay == getToday()) resp = 'yesterday';
  return resp;
}

export function setPeriodTitle(task) {
  task.periodStart = normalizeDate(task.periodStart);
  const startTitle = getTextDate(task.periodStart);
  const endTitle = task.endDate ? getTextDate(task.endDate) : null;

  if (task.special == 'oneTime' && task.period.length == 1) {
    task.periodTitle = `Only ${startTitle}`;
  } else if (task.special == 'untilComplete' && task.endDate) {
    task.periodTitle = `${task.disabled ? 'Ended' : 'Complete until'} ${endTitle}`;
  } else if (task.periodStart > getToday()) {
    task.periodTitle += ` from ${startTitle}`;
  } else if (task.endDate && !task.disabled) {
    task.periodTitle += ` to ${endTitle}`;
  }
}

export async function onTaskCompleteClick({ e, globals, elem, forcedDay, extraFunc }) {
  const td = await globals.db.getItem('tasks', elem.dataset.id);
  const date = forcedDay ? forcedDay : getToday().toString();
  const day = await globals.db.getItem('days', date);
  if (!day) return globals.floatingMsg({
    text: `${emjs.alarmClock} Day is expired! So you need to reload tasks for today`,
    onClick: async () => await reloadApp(globals),
    button: 'Reload', longButton: `${emjs.reload} Reload app`,
    pageName: 'main'
  });
  const value = toggleFunc({e, elem});
  td.history.pop();
  td.history.push(value);
  day.tasks[td.priority][td.id] = value;
  day.afterDayEndedProccessed = false;
  await globals.db.setItem('tasks', td);
  await globals.db.setItem('days', day);
  if (extraFunc) await extraFunc(day, value);
}

export function getTaskComplete(td) {
  return td.history.at(-1) ? emjs.sign : emjs.blank;
}
