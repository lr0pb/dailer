import { getToday, oneDay, getTextDate, isCustomPeriod } from '../highLevel/periods.js'
import { getTaskRestoreInfo } from '../highLevel/taskThings.js'
import { qs } from '../../utils/dom.js'
import { taskHistory } from '../highLevel/taskHistory.js';

export function getPeriodsData(task) {
  let activeDays = 0;
  for (let day of task.period) { if (day) activeDays++; }
  const periodsInWeek = 7 / task.period.length;
  return {
    periodsInWeek, daysInWeek: activeDays * periodsInWeek,
    runnedPeriods: periodsInWeek * (getToday() - task.periodStart) / (7 * oneDay)
  };
}

function createInfoRect(emoji, text, color, coef = 1, isLined) {
  const elem = `
    <div class="infoRect ${isLined ? 'lined' : ''}" style="${
      `--color: var(--${color}); --coef: ${coef};`
    }">
      <h4>${emoji}</h4><h3>${text}</h3>
    </div>
  `;
  qs('.itemsHolder').innerHTML += elem;
}

export function renderItemsHolder({task, periods, priorities, ihs}) {
  const { daysInWeek, periodsInWeek, runnedPeriods } = getPeriodsData(task);
  const showQS = ihs && runnedPeriods >= periodsInWeek;
  const untilComplete = task.special == 'untilComplete';
  const oneTime = task.special == 'oneTime';
  const { canRestore, restoreText } = getTaskRestoreInfo(task, true);

  getTitle({task, periods, untilComplete, oneTime, ihs, showQS, canRestore});
  getActive({task, untilComplete});
  getImportance({task, priorities});
  getQuickStats({task, showQS, daysInWeek});
  getCompleted({task, ihs});
  getRestore({task, canRestore, restoreText});
}

function getTitle({
  task, periods, untilComplete, oneTime, ihs, showQS, canRestore
}) {
  const rawTitle = periods[task.periodId].title;
  const perTitle = isCustomPeriod(task.periodId)
  ? `<span class="customTitle" data-period="${task.periodId}">${rawTitle}</span>` : rawTitle;
  const startTitle = getTextDate(task.periodStart);
  const endTitle = task.endDate ? getTextDate(task.endDate - oneDay) : null;
  const daysCount = (task.endDate - task.periodStart) / oneDay;
  const periodText = !task.special
    ? `${perTitle} from ${startTitle}${task.endDate ? ` to ${endTitle}` : ''}`
    : (task.endDate
      ? `${perTitle}${task.disabled && task.endDate <= getToday() ? `. Ended${
        untilComplete && daysCount ? ` in ${daysCount} days on` : ''
      }` : ' to'} ${endTitle}` : task.periodTitle);
  let titleCoef;
  if (untilComplete) titleCoef = canRestore ? 1 : 2;
  else if (oneTime && canRestore) titleCoef = 1;
  else if ((!ihs && !task.disabled) || showQS) titleCoef = 1;
  else titleCoef = 2;
  const isNarrow = (untilComplete || (oneTime && task.disabled)) && !canRestore;
  createInfoRect(emjs.calendar, periodText, 'blue', titleCoef, isNarrow);
}

function getActive({task, untilComplete}) {
  const isActive = task.period[task.periodDay];
  const isActiveText = `Today ${isActive ? 'you should do' : `you haven't`} this task`;
  if (!task.disabled && !untilComplete) createInfoRect(
    emjs[isActive ? 'alarmClock' : 'moon'], isActiveText, isActive ? 'green' : 'yellow'
  );
}

function getImportance({task, priorities}) {
  const prior = priorities[task.priority];
  const isLine = task.disabled && !task.special;
  createInfoRect(
    emjs[prior.emoji || 'fire'], `Importance: ${prior.title}`,
    prior.color, isLine ? 2 : 1, isLine
  );
}

function getQuickStats({task, showQS, daysInWeek}) {
  if (!showQS) return;
  const isMaxStreak = task.streak == task.maxStreak;
  const d = task.disabled;
  createInfoRect(
    emjs[d ? 'trophy' : isMaxStreak ? 'party' : 'chartUp'],
    `${d ? 'In prime y' : 'Y'}ou complete task ${
      task.streak + 1 * (taskHistory.getLastValue(task) === 1 ? 1 : 0)
    } times in a row${!d && isMaxStreak ? '!' : ''}`,
    d ? 'yellow' : isMaxStreak ? 'red' : 'blue'
  );
}

function getCompleted({task, ihs}) {
  if (ihs) return;
  const isCompleted = task.history.run[0];
  let emoji = emjs.cross, color = 'red';
  if (isCompleted) emoji = emjs.sign, color = 'green';
  createInfoRect(emoji, `Task ${
    task.history.length && task.disabled ? 'was' : 'is'
  } ${isCompleted ? '' : 'not '}completed`, color);
}

function getRestore({task, canRestore, restoreText}) {
  if (dailerData.experiments && task.special && canRestore) {
    createInfoRect(emjs.reload, restoreText, 'green');
  }
}
