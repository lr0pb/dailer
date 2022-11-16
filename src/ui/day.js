import { handleKeyboard } from '../utils/dom';
import { getToday } from '../workers/defaultFunctions';

export function renderDay({globals, day, page, firstDayEver}) {
  const numberDate = Number(day.date);
  const date = new Date(numberDate);
  const elem = document.createElement('div');
  elem.className = 'day';
  elem.setAttribute('role', 'button');
  elem.tabIndex = dailerData.focusgroup ? (!page.children ? 0 : -1) : 0;
  elem.dataset.date = day.date;
  elem.innerHTML = `
    <div>
      <h4>${date.getDate()}</h4>
      <div>
        ${day.tasksAmount === 0 ? `<h3>${emjs.empty} No tasks</h3>` : ''}
        ${day.completed ? `<h3>${emjs.party}</h3>` : ''}
        ${numberDate == getToday() ? `<h3>${emjs.calendar} This is today</h3>` : (
          day.tasksAmount ? `<h4>${day.completedTasks}/${day.tasksAmount}</h4>` : ''
        )}
      </div>
    </div>
    <div class="achivmentsList">
      ${Number(day.date) == firstDayEver ? `
        <div class="dayAchivment" role="button">
          <h3>${emjs.trophy} This is your first day using dailer!</h3>
        </div>
      ` : ''}
    </div>
  `;
  page.append(elem);
  elem.addEventListener('click', async () => {
    globals.message({
      state: 'success', text: date.getDate()
    });
    /*await globals.paintPage('dayInfo', { params: {
      date: day.date
    } });*/
  });
  handleKeyboard(elem);
  return elem;
}
