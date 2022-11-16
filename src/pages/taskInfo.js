import { qs, getElements } from '../utils/dom.js'
import { syncGlobals } from '../utils/appState.js'
import { taskHistory } from './highLevel/taskHistory.js'
import { renderItemsHolder, getPeriodsData } from './taskInfo/itemsHolder.js'
import { renderHistory } from './taskInfo/history.js'

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
  onPageShow: async ({globals, params}) => {
    syncGlobals(globals);
    if (globals.pageInfo.stateChangedTaskId) qs('#edit').style.display = 'none';
    if (!globals.pageInfo.dataChangedTaskId) return;
    if (!globals.pageInfo.taskId) globals.pageInfo.taskId = params.id;
    const td = await globals.db.get('tasks', globals.pageInfo.taskId);
    const periods = await globals.getPeriods();
    const priorities = await globals.getList('priorities');
    qs('#infoBackground h4').innerHTML = td.name;
    qs('.itemsHolder').innerHTML = '';
    const ihs = taskHistory.isSupported(td);
    renderItemsHolder({task: td, periods, priorities, ihs});
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
  const task = await globals.db.get('tasks', globals.pageInfo.taskId);
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
  if (!task.deleted) {
    edit.classList.remove('hidedUI');
    edit.addEventListener('click', async () => {
      if (!globals.pageInfo) syncGlobals(globals);
      globals.pageInfo.taskAction = 'edit';
      await globals.paintPage('taskCreator', { dontClearParams: true });
    });
  }
  const iha = taskHistory.isAvailable(task);
  const ihs = taskHistory.isSupported(task);
  const isa = isStatsAvailable(task);
  const base = (cl) => `
    <div class="${cl}">
      <div id="infoBackground">
        <h4>${task.name}</h4>
      </div>
      <div class="itemsHolder"></div>
    </div>
  `;
  if (!iha) {
    page.classList.remove('doubleColumns');
    page.style.alignItems = 'center';
  }
  !iha
  ? page.innerHTML = `
    <div id="onboardingBg" class="content abs center">
      <div class="content abs circle"></div>
      <div class="content abs circle"></div>
      <div class="content abs circle"></div>
      <div class="content abs circle"></div>
    </div>
    ${base('abs')}
  ` : page.innerHTML = `
    ${base('columnFlex')}
    <div class="fullHeight">${isa ? `
      <h2>Stats</h2>
      <div id="stats" class="content center">
        <h2 class="emoji">${emjs.sparkles}</h2>
        <h3>Stats for this tasks are available and will appear in future updates</h3>
      </div>
      ` : isa === false && !task.disabled ? `
      <h2>Stats</h2>
      <div class="content center">
        <h2 class="emoji">${emjs.empty}</h2>
        <h3>Stats will be available after you run this task for 2 weeks</h3>
      </div>` : ''
    }${iha ? `
      <h2>History</h2>
      <div id="history" class="hiddenScroll"></div>
      <h3>${emjs.light} Click on point in history to see more about that day</h3>
      <div id="dayNotice" class="first"></div>
    ` : ''
    }</div>
  `;
  /*await Promise.all([
    new Promise((res) => {
      renderItemsHolder({task, periods, priorities, iha});
      res();
    }),
    new Promise(async (res) => {
      if (iha) await renderHistory(task);
      res();
    })
  ]);*/
  renderItemsHolder({task, periods, priorities, ihs});
  if (iha) await renderHistory(task);
}

function isStatsAvailable(task) {
  /*if (!dailerData.experiments)*/ return undefined;
  if (task.special && task.period.length == 1) return undefined;
  const { periodsInWeek, runnedPeriods } = getPeriodsData(task);
  if (runnedPeriods >= periodsInWeek * 2) return true;
  if (task.disabled || task.deleted) return undefined;
  return false;
}
