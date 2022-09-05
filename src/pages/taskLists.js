import { qs, /*emjs,*/ syncGlobals } from './highLevel/utils.js'
import { renderTask, showNoTasks } from './highLevel/taskThings.js'

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
  onPageShow: async ({globals, page}) => {
    await onBackupUploaded({globals, page});
    const periods = await globals.getPeriods();
    const priorities = await globals.getList('priorities');
    let id = globals.pageInfo.stateChangedTaskId;
    if (id) {
      const elem = qs(`[data-id="${id}"]`);
      if (elem) elem.remove();
    }
    if (!page.children.length) showNoTasks(page);
    delete globals.pageInfo.stateChangedTaskId;
    id = globals.pageInfo.dataChangedTaskId;
    if (!id) return;
    const td = await globals.db.getItem('tasks', id);
    const elem = qs(`[data-id="${id}"]`);
    if (!elem && page.classList.contains('center')) {
      page.innerHTML = '';
      page.classList.remove('center');
    }
    const task = renderTask({ type: 'edit', globals, td, page: elem ? null : page, periods, priorities });
    if (elem && task) elem.replaceWith(task);
    delete globals.pageInfo.dataChangedTaskId;
  },
  onSettingsUpdate: onBackupUploaded
};

const meta = {
  planCreator: { bad: (td) => td.deleted || td.disabled },
  tasksArchive: {
    bad: (td) => td.wishlist || td.deleted || !td.disabled,
    sort: (t1, t2) => {
      const chooseDate = (t) => t.special == 'untilComplete' && t.endDate ? t.endDate : t.periodStart;
      const t1date = chooseDate(t1);
      const t2date = chooseDate(t2);
      if (t1date > t2date) return -1;
      if (t1date === t2date) return 0;
      return 1;
    }
  }
};

async function onPlanCreator({globals, page}) {
  globals.pageButton({
    emoji: emjs.book, title: 'Open tasks archive', onClick: () => globals.paintPage('tasksArchive')
  });
  qs('#back').addEventListener('click', () => history.back());
  qs('#addTask').addEventListener('click', () => globals.paintPage('taskCreator'));
  await renderProgressiveTasksList({ globals, page, isBadTask: meta.planCreator.bad });
}

export const tasksArchive = {
  get title() { return `${emjs.book} Your archived tasks`},
  get header() { return `${emjs.book} Archived tasks`},
  get page() { return ``},
  styleClasses: 'doubleColumns',
  get footer() { return `<button id="back" class="secondary">${emjs.back} Back</button>`},
  script: onTasksArchive,
  onSettingsUpdate: onBackupUploaded
};

async function onTasksArchive({globals, page}) {
  qs('#back').addEventListener('click', () => history.back());
  await renderSortedTasksList({
    globals, page, isBadTask: meta.tasksArchive.bad, sort: meta.tasksArchive.sort
  });
}

async function renderProgressiveTasksList({globals, page, isBadTask}) {
  page.classList.remove('center');
  page.innerHTML = '';
  const periods = await globals.getPeriods();
  const priorities = await globals.getList('priorities');
  await globals.db.getAll('tasks', (td) => {
    if (isBadTask(td)) return;
    renderTask({type: 'edit', globals, td, page, periods, priorities});
  });
  if (!page.children.length) showNoTasks(page);
}

async function renderSortedTasksList({globals, page, isBadTask, sort}) {
  const tasks = await globals.db.getAll('tasks');
  const periods = await globals.getPeriods();
  const priorities = await globals.getList('priorities');
  page.innerHTML = '';
  let prevTask = null, prevTaskId = null;
  const setPrev = (task, id) => { prevTask = task; prevTaskId = id; };
  for (let i = 0; i < tasks.length; i++) {
    // one loop with filtering, sorting and action with data instead of
    // 3 loops for all this actions
    let td = prevTask || tasks[i]; // td stands for task's data
    if (isBadTask(td)) continue;
    if (sort) {
      while (isBadTask(tasks[i + 1] || td)) { i++; }
      const nextTask = tasks[i + 1] || td;
      const resp = sort(td, nextTask);
      if (resp === -1) {
        td = nextTask;
        setPrev(tasks[i], i);
      } else if (resp === 0) {
        td = prevTaskId ? tasks[prevTaskId] : td;
        prevTaskId ? setPrev(tasks[i], i) : setPrev(null, null);
      } else if (resp === 1) {
        td = prevTaskId ? tasks[prevTaskId] : td;
        setPrev(null, null);
      }
    }
    renderTask({type: 'edit', globals, td, page, periods, priorities});
  }
  if (!page.children.length) showNoTasks(page);
}

async function onBackupUploaded({globals, page}) {
  if (!globals.pageInfo) syncGlobals(globals);
  if (!globals.pageInfo.backupUploaded) return;
  const args = {
    globals, page, isBadTask: meta[globals.pageName].bad, sort: meta[globals.pageName].sort
  };
  meta[globals.pageName].sort ? await renderSortedTasksList(args) : await renderProgressiveTasksList(args);
}
