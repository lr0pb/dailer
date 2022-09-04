import { globQs as qs, globQsa as qsa, intlDate, show, hide } from './utils.js'
import { getToday, oneDay, isCustomPeriod } from './periods.js'
import { createPeriod } from '../periodCreator.js'
import { createTask } from '../taskCreator.js'
import { isHistoryAvailable, getHistory } from '../taskInfo.js'

export async function uploadData(globals, paintPeriods) {
  const chooser = qs('#chooseFile');
  chooser.disabled = false;
  chooser.addEventListener('change', () => {
    chooser.disabled = true;
    const file = chooser.files[0];
    if (!file.name.includes('.dailer')) return globals.message({
      state: 'fail', text: 'Wrong file choosed'
    });
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = async () => {
      const data = JSON.parse(reader.result);
      if (typeof data !== 'object') return globals.message({
        state: 'fail', text: 'Unknown file content'
      });
      const cr = data.dailer_created;
      if ( !cr || (cr !== getToday()) ) return globals.message({
        state: 'fail', text: `You must upload today's created backup`
      });
      await uploading(globals, data);
      await paintPeriods(globals);
      qs(`[data-section="import"]`).scrollIntoView();
    };
  });
  chooser.click();
}

export async function uploading(globals, data) {
  qsa('.beforeUpload').forEach(hide);
  qsa('.uploadUI').forEach(show);
  const session = await globals.db.getItem('settings', 'session');
  session.lastTasksChange = Date.now();
  const periodsConvert = {};
  for (let per of data.dailer_periods) {
    const period = await createPeriod(globals, per);
    periodsConvert[per.id] = period.id;
    await globals.db.setItem('periods', period);
  }
  const periods = await globals.getPeriods();
  const days = {};
  await globals.db.getAll('days', (day) => { days[day.date] = day; });
  let earliestDay = getToday();
  const tasks = [];
  for (let td of data.dailer_tasks) {
    if (td.periodStart < earliestDay) earliestDay = td.periodStart;
    td.id = Date.now().toString();
    if (isCustomPeriod(td.periodId)) td.periodId = periodsConvert[td.periodId];
    const task = await createTask(globals, td);
    tasks.push(task);
    if (
      (task.special == 'oneTime' ? task.periodStart : task.endDate) == getToday() - oneDay
    ) session.updateTasksList.push(task.id);
    await globals.db.setItem('tasks', task);
  }
  await globals.db.setItem('settings', session);
  const diff = (getToday() - earliestDay + oneDay) / oneDay;
  for (let i = 0; i < diff; i++) {
    const date = earliestDay + oneDay * i;
    if (days[date]) continue;
    days[date] = await globals.worker.call({ process: 'getRawDay', args: [date, true] });
  }
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const iha = isHistoryAvailable(task);
    const onActiveDay = async (date, item) => {
      const day = days[date];
      if (!day) return;
      console.log(`${task.name} ${intlDate(date)}`);
      day.tasks[task.priority][task.id] = item;
    };
    if (iha) await getHistory({ task, onActiveDay });
    else if (iha === false && task.special == 'oneTime') {
      await onActiveDay(task.periodStart, task.history[0]);
    } else if (iha === false && task.special == 'untilComplete') {
      const endDate = task.endDate ? Math.min(getToday(), task.endDate) : getToday();
      await onActiveDay(endDate, task.history[0]);
    }
  }
  for (let date in days) { await globals.db.setItem('days', days[date]); }
  globals.pageInfo = { backupUploaded: true };
  qsa('.uploadUI').forEach(hide);
  qsa('.uploadSuccess').forEach(show);
}
