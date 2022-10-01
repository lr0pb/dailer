import { qs } from '../utils/dom.js'
import { syncGlobals } from '../utils/appState.js'
import {
  renderTask, showNoTasks, getTaskRestoreInfo
} from './highLevel/taskThings.js'

export const planCreator = {
  get title() { return `${emjs.notes} Your tasks list`},
  get header() { return `${emjs.notes} Your tasks`},
  get page() { return ``},
  styleClasses: 'doubleColumns',
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="addTask">${emjs.paperWPen} Add task</button>
  `},
  script: onPlanCreator,
  onPageShow,
  onSettingsUpdate: onBackupUploaded
};

const meta = {
  planCreator: {
    bad: (td) => td.deleted || td.disabled,
    buttons: () => {
      return { editTask: true, deleteTask: true };
    }
  },
  tasksArchive: {
    bad: (td) => !(td.wishlist || td.deleted || !td.disabled),
    sort: (t1, t2) => {
      const chooseDate = (t) => t.endDate ? t.endDate : t.periodStart;
      const t1date = chooseDate(t1);
      const t2date = chooseDate(t2);
      if (t1date > t2date) return 1;
      if (t1date === t2date) return 0;
      return -1;
    },
    buttons: (td) => {
      const { canRestore } = getTaskRestoreInfo(td);
      return { editTask: canRestore };
    }
  }
};

async function onPlanCreator({globals, page}) {
  globals.pageButton({
    emoji: emjs.book, title: 'Open tasks archive', onClick: async () => {
      await globals.paintPage('tasksArchive');
    }
  });
  qs('#back').addEventListener('click', () => history.back());
  qs('#addTask').addEventListener('click', async () => {
    await globals.paintPage('taskCreator');
  });
  const name = 'planCreator';
  await renderProgressiveTasksList(getArgs(globals, page));
}

export const tasksArchive = {
  get title() { return `${emjs.book} Your archived tasks`},
  get header() { return `${emjs.book} Archived tasks`},
  get page() { return ``},
  styleClasses: 'doubleColumns',
  get footer() { return `<button id="back" class="secondary">${emjs.back} Back</button>`},
  script: onTasksArchive,
  onPageShow,
  onSettingsUpdate: onBackupUploaded
};

async function onTasksArchive({globals, page}) {
  qs('#back').addEventListener('click', () => history.back());
  const name = 'tasksArchive';
  await renderSortedTasksList(getArgs(globals, page));
}

async function renderProgressiveTasksList({
  globals, page, isBadTask, getButtonParams
}) {
  page.classList.remove('center');
  page.innerHTML = '';
  const periods = await globals.getPeriods();
  const priorities = await globals.getList('priorities');
  const extendedInfo = { periods, priorities };
  await globals.db.getAll('tasks', (td) => {
    if (isBadTask(td)) return;
    renderTask(globals, td, page, {
      openTask: true, extendedInfo, ...getButtonParams(td)
    });
  });
  if (!page.children.length) showNoTasks(page);
}

async function renderSortedTasksList({
  globals, page, isBadTask, sort, getButtonParams
}) {
  let tasks = await globals.db.getAll('tasks');
  const periods = await globals.getPeriods();
  const priorities = await globals.getList('priorities');
  const extendedInfo = { periods, priorities };
  page.innerHTML = '';
  tasks
    .filter(isBadTask)
    .sort(sort)
    .forEach((td) => {
      renderTask(globals, td, page, {
        openTask: true, extendedInfo, ...getButtonParams(td)
      });
    });
  if (!page.children.length) showNoTasks(page);
}

function getArgs(globals, page) {
  const name = globals.pageName;
  return {
    globals, page, isBadTask: meta[name].bad,
    sort: meta[name].sort, getButtonParams: meta[name].buttons
  };
}

async function onBackupUploaded({globals, page}) {
  if (!globals.pageInfo) syncGlobals(globals);
  if (!globals.pageInfo.backupUploaded) return;
  const args = getArgs(globals, page);
  meta[globals.pageName].sort
  ? await renderSortedTasksList(args)
  : await renderProgressiveTasksList(args);
}

async function onPageShow({globals, page}) {
  await onBackupUploaded({globals, page});
  let id = globals.pageInfo.stateChangedTaskId;
  if (id) {
    const elem = qs(`[data-id="${id}"]`);
    if (elem) elem.remove();
  }
  if (!page.children.length) showNoTasks(page);
  if (globals.pageName == 'planCreator') {
    delete globals.pageInfo.stateChangedTaskId;
  }
  id = globals.pageInfo.dataChangedTaskId;
  if (!id) return;
  const td = await globals.db.get('tasks', id);
  const elem = qs(`[data-id="${id}"]`);
  if (!elem && page.classList.contains('center')) {
    page.innerHTML = '';
    page.classList.remove('center');
  }
  const periods = await globals.getPeriods();
  const priorities = await globals.getList('priorities');
  const extendedInfo = { periods, priorities };
  const task = renderTask(globals, td, elem ? null : page, {
    openTask: true, extendedInfo, ...meta[globals.pageName].buttons(td)
  });
  if (elem && task) elem.replaceWith(task);
  delete globals.pageInfo.dataChangedTaskId;
}
