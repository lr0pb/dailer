import { renderDay } from '../ui/day.js';
import { qs } from '../utils/dom.js'
import { getToday, oneDay, normalizeDate } from './highLevel/periods.js';
import { getMonthId } from './highLevel/taskHistory.js';

export const daysHistory = {
  get header() { return `${emjs.fileBox} Days history`},
  get page() { return `
    <h2>November 2022</h2>
  `; const a = `
    <h2>September 2022</h2>
    <div class="doubleColumns first">
      <div class="day" role="button" tabindex="0">
        <div>
          <h4>15</h4>
          <div>
            <h3>${emjs.empty} No tasks</h3>
          </div>
        </div>
        <div class="achivmentsList"></div>
      </div>
      <div class="day" role="button" tabindex="0">
        <div>
          <h4>16</h4>
          <div>
            <h4>5/7</h4>
          </div>
        </div>
        <div class="achivmentsList"></div>
      </div>
      <div class="day" role="button" tabindex="0">
        <div>
          <h4>17</h4>
          <div>
            <h4>2/7</h4>
          </div>
        </div>
        <div class="achivmentsList">
          <div class="dayAchivment" role="button">
            <h3>${emjs.magicBall} You done all tasks for first time</h3>
          </div>
        </div>
      </div>
      <div class="day" role="button" tabindex="0">
        <div>
          <h4>18</h4>
          <div>
            <h3>${emjs.party}</h3>
            <h4>3/3</h4>
          </div>
        </div>
        <div class="achivmentsList">
          <div class="dayAchivment" role="button">
            <h3>${emjs.magicBall} You done all tasks for first time</h3>
          </div>
          <div class="dayAchivment" role="button">
            <h3>${emjs.magicBall} You done all tasks for first time</h3>
          </div>
        </div>
      </div>
    </div>
  `},
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
  `},
  script: async ({globals, page}) => {
    qs('#back').addEventListener('click', () => history.back());
    const session = await globals.db.get('settings', 'session');
    const monthId = getMonthId({ date: new Date(getToday()) });
    console.log(monthId);
    const month = document.createElement('div');
    month.className = 'doubleColumns first';
    month.dataset.monthId = monthId;
    page.append(month);
    //const [y, m] = monthId.split('-');
    const firstDay = normalizeDate(new Date(monthId)) + oneDay;
    console.log(new Date(firstDay));
    //const lastDate = new Date(getMonthLastDate(m, y)).getDate();*/
    const start = Math.max(firstDay, session.firstDayEver);
    console.log(start == firstDay);
    //const today = new Date(getToday()).getDate();
    const delta = (getToday() - start) / oneDay;
    console.log(delta);
    for (let i = 0; i <= delta; i++) {
      const id = start + oneDay * i;
      const day = await globals.db.get('days', String(id));
      renderDay({ globals, day, page: month, firstDayEver: session.firstDayEver });
    }
  }
};
