import { globQs as qs, globQsa as qsa, show, hide } from '../../utils/dom.js'
import { getToday, oneDay, intlDate, isCustomPeriod } from './periods.js'
import { createPeriod } from '../periodCreator.js'
import { createTask } from '../taskCreator.js'
import { getHistory, taskHistory } from './taskHistory.js'

export async function uploadData(globals, paintPeriods) {
  const chooser = qs('#chooseFile');
  chooser.disabled = false;
  chooser.addEventListener('change', () => {
    chooser.disabled = true;
    const file = chooser.files[0];
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (typeof data !== 'object') throw new Error();
        const createdAt = data.dailer_created;
        if (!createdAt) throw new Error();
      } catch (err) {
        return globals.message({
          state: 'fail', text: 'Unknown file content'
        });
      }
      await uploading(globals, data);
      await paintPeriods(globals);
      qs(`[data-section="manageData"]`).scrollIntoView();
    };
  });
  chooser.click();
}

export async function uploading(globals, data) {
  return;
  qsa('.beforeUpload').forEach(hide);
  qsa('.uploadUI').forEach(show);
  const session = await globals.db.get('settings', 'session');
  session.lastTasksChange = Date.now();
  const periodsConvert = {};
  for (let per of data.dailer_periods) {
    const period = await createPeriod(globals, per);
    periodsConvert[per.id] = period.id;
    await globals.db.set('periods', period);
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
    await globals.db.set('tasks', task);
  }
  await globals.db.set('settings', session);
  const diff = (getToday() - earliestDay + oneDay) / oneDay;
  for (let i = 0; i < diff; i++) {
    const date = earliestDay + oneDay * i;
    if (days[date]) continue;
    days[date] = await globals.worker.call({ process: 'getRawDay', args: [date, true] });
  }
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const iha = taskHistory.isAvailable(task);
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
  for (let date in days) { await globals.db.set('days', days[date]); }
  globals.pageInfo = { backupUploaded: true };
  qsa('.uploadUI').forEach(hide);
  qsa('.uploadSuccess').forEach(show);
}
