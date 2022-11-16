import { getRawDate, getMonthLastDate, oneDay } from '../highLevel/periods.js'
import { borderValues, getMonthId, taskHistory } from '../highLevel/taskHistory.js'
import { qs, handleKeyboard } from '../../utils/dom.js'

const formatter = {
  day: new Intl.DateTimeFormat('en', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }),
  month: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
}

function createMonth(date, month) {
  const container = document.createElement('div');
  container.dataset.month = month;
  container.innerHTML = `
    <h3>${formatter.month.format(date)}</h3>
    <div class="monthContainer">
      <div class="historyMonth" ${
        dailerData.focusgroup ? `focusgroup="horizontal extend"` : ''
      }></div>
    </div>
  `;
  const elem = container.querySelector('.historyMonth');
  elem.addEventListener('click', onHistoryDayClick);
  handleKeyboard(elem);
  return { container, elem };
}

function onHistoryDayClick(e) {
  const target = e.target.dataset.day
  ? e.target : e.target.parentElement.dataset.day
  ? e.target.parentElement : e.target.parentElement.parentElement;
  if (!target.hasAttribute('role')) return;
  const date = new Date(Number(target.dataset.day));
  if (target.classList.contains('selectedDay')) {
    target.classList.remove('selectedDay');
    qs('#dayNotice').innerHTML = ``;
  } else {
    qs('.selectedDay')?.classList.remove('selectedDay');
    target.classList.add('selectedDay');
    qs('#dayNotice').innerHTML = `
      <div class="floatingMsg notFixed">
        <h3>${emjs.calendar} ${formatter.day.format(date)}</h3>
        <!--<button class="noEmoji">View&nbsp;day</button>-->
      </div>
    `;
  }
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

function getAdditionalDayTime(m, i) {
  const sign = m == 2 ? -1 : m == 9 ? 1 : 0;
  const useSign = (m == 2 && i == 26) || (m == 9 && i == 29) ? 1 : 0;
  return oneDay + useSign * sign * oneDay / 24;
}

function renderEmptyDays(hm, count, firstDay) {
  const firstDate = new Date(firstDay);
  const day = firstDate.getDate();
  const m = firstDate.getMonth();
  for (let i = 0; i < count; i++) {
    const date = firstDay ? firstDay + getAdditionalDayTime(m, day + i) : null;
    hm.text += `
      <h4 ${firstDay ? `data-day="${date}"` : ''} class="darkText">${
        firstDay ? day + i : ' '
      }</h4>
    `;
  }
}

function init(date, hm) {
  date = new Date(date);
  const month = date.getMonth();
  const year = date.getFullYear();
  const resp = { month, year };
  const monthId = getMonthId({month, year});
  const monthResp = createMonth(date, monthId);
  hm.container = monthResp.container;
  hm.elem = monthResp.elem;
  hm.text = '';
  const firstMonthDay = new Date(year, month, 1);
  if (firstMonthDay.getTime() !== date.getTime()) {
    const beforeMonthDays = borderValues(firstMonthDay.getDay());
    renderEmptyDays(hm, beforeMonthDays);
  }
  renderEmptyDays(hm, date.getDate() - 1, 1);
  const emptyDays = borderValues(date.getDay());
  let rwd = null; // remainingWeekendDays
  if (date.getDate() !== 1) {
    rwd = getWeekendDays(date, month);
  }
  if (!rwd) renderEmptyDays(hm, emptyDays);
  resp.isFirstDay = true;
  return resp;
}

const buttonable = (tabIndex) => `role="button" tabindex="${tabIndex ? 0 : -1}"`;

export async function renderHistory(task) {
  const history = qs('#history');
  const hm = {};
  const lastMonth = taskHistory.getLastMonth(task);
  let date = null;
  for (const monthId in task.history) {
    if (!date) date = getRawDate(monthId);
    const { month: m, year: y } = init(date, hm);
    const month = task.history[monthId];
    for (let i = 0; i < month.length; i++) {
      const value = month[i];
      const isToday = monthId == lastMonth && i + 1 == month.length;
      const tabIndex = dailerData.focusgroup ? !i || isToday : true;
      hm.text += `
        <h4 data-day="${date}" class="${[2, 3].includes(value) ? 'darkText' : ''}${
          isToday ? ' today' : ''
        }" ${value == 3 ? '' : buttonable(tabIndex)}>${
          [2, 3].includes(value) ? i + 1 : `
            <div class="historyDay" style="--color: var(--accent${
              value ? 'Green' : 'Red'
            }RGB);">${emjs[value ? 'sign' : 'cross']}</div>
          `
        }</h4>
      `;
      date += getAdditionalDayTime(m, i);
    }
    const lastMonthDate = getMonthLastDate(m, y);
    console.log(lastMonthDate);
    console.log(date);
    const daysToEnd = (lastMonthDate - date) / oneDay;
    console.log(daysToEnd);
    renderEmptyDays(hm, daysToEnd, date);
    hm.elem.innerHTML = hm.text;
    history.append(hm.container);
    hm.text = '';
  }
  qs('#history > div:last-child').scrollIntoView();
  qs('.content > :first-child').scrollIntoView();
}
