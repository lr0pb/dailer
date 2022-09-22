import { getToday, oneDay } from '../highLevel/periods.js'
import { borderValues, getHistory } from '../highLevel/taskThings.js'
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
  if (!target.role) return;
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

function renderEmptyDays(hm, count, firstDay) {
  for (let i = 0; i < count; i++) {
    const date = firstDay ? firstDay + oneDay * i : null;
    hm.text += `
      <h4 ${firstDay ? `data-day="${date}"` : ''} class="darkText">${
        firstDay ? new Date(date).getDate() : ' '
      }</h4>
    `;
  }
}

function init(date, hm) {
  const month = date.getMonth();
  const year = date.getFullYear();
  const resp = { month, year };
  const monthId = `${month}-${year}`;
  if (
    !hm.elem ||
    hm.elem.parentElement.parentElement.dataset.month !== monthId
  ) {
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
      /*const firstWeekendDay = new Date(rwd.at(-1)).getDay();
      renderEmptyDays(hm, borderValues(firstWeekendDay));
      for (let i = 1; i < rwd.length + 1; i++) {
        const weekendDay = new Date(rwd.at(-1 * i));
        hm.innerHTML += `<h4 style="opacity: 0.25;">${weekendDay.getDate()}</h4>`
        if (weekendDay.getDay() == 0 && i !== rwd.length) {
          renderEmptyDays(hm, 5);
        }
      }*/
    }
    if (
      /*(rwd && rwd[0] + oneDay !== date.getTime()) ||*/ !rwd
    ) renderEmptyDays(hm, emptyDays);
    resp.isFirstDay = true;
  }
  return resp;
}

const buttonable = (tabIndex) => `role="button" tabindex="${tabIndex ? 0 : -1}"`;

export async function renderHistory(task) {
  const history = qs('#history');
  const hm = {};
  const initial = (date) => {
    date = new Date(date);
    const { month, year, isFirstDay } = init(date, hm);
    const isToday = date.getTime() == getToday();
    const lastMonthDate = new Date(year, month + 1, 0).getTime();
    return {
      tabIndex: dailerData.focusgroup ? isFirstDay || isToday : true,
      isToday, lastMonthDate, isLastDay: lastMonthDate == date.getTime()
    };
  };
  const after = (date, resp) => {
    const daysToEnd = (resp.lastMonthDate - date) / oneDay;
    const isEndDate = date == task.endDate;
    if (resp.isToday || isEndDate) {
      renderEmptyDays(hm, daysToEnd, date + oneDay);
    }
    if (resp.isToday || resp.isLastDay || isEndDate) {
      hm.elem.innerHTML = hm.text;
      history.append(hm.container);
      hm.text = '';
    }
  };
  await getHistory({
    task,
    onBlankDay: (date) => {
      const resp = initial(date);
      hm.text += `
        <h4 data-day="${date}" class="darkText${
         resp.isToday ? ' today' : ''
        }" ${buttonable(resp.tabIndex)}>${
          new Date(date).getDate()
        }</h4>
      `;
      after(date, resp);
    },
    onActiveDay: (date, item) => {
      const resp = initial(date);
      hm.text += `
        <h4 data-day="${date}"${
          resp.isToday ? ` class="today"` : ''
        } ${buttonable(resp.tabIndex)}>
          <div class="historyDay"style="--color: var(--accent${
            item ? 'Green' : 'Red'
          }RGB);">${emjs[item ? 'sign' : 'cross']}</div>
        </h4>
      `;
      after(date, resp);
    }
  });
  qs('#history > div:last-child').scrollIntoView();
  qs('.content > :first-child').scrollIntoView();
}
