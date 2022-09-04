import { getToday, oneDay } from './highLevel/periods.js'
import { qs, qsa, show, hide, getElements } from './highLevel/utils.js'
import { renderTask } from './highLevel/taskThings.js'

export const recap = {
  get header() { return `${emjs.newspaper} Recap of the day`},
  noSettings: true,
  get page() { return `
    <h2 class="emoji completed">${emjs.party}${emjs.sign}</h2>
    <h2 class="completed" id="congrats">Congratulations! </h2>
    <h3>You done <span id="tasksCount"></span> tasks yesterday</h3>
    <progress id="dayProgress"></progress>
    <h3 class="forgotten">
      Check the tasks you didn't complete yesterday and if need mark the ones you forgot
    </h3>
    <div class="forgotten content doubleColumns first" id="tasks" focusgroup="horizontal"></div>
    <h3 class="forgotten">Tasks with period "One time until complete" not counting as not completed</h3>
  `},
  get footer() { return `
    <button id="toMain">${emjs.forward} Proceed to today</button>
  `},
  script: async ({globals, page}) => {
    const { response, day } = await globals.worker.call({ process: 'getYesterdayRecap' });
    const date = String(getToday() - oneDay);
    qs('#toMain').addEventListener('click', async () => {
      await globals.db.updateItem('settings', 'session', (session) => {
        session.recaped = getToday();
      });
      await globals.db.updateItem('days', date, (day) => {
        delete day.forgottenTasks;
        day.afterDayEndedProccessed = true;
      });
      await globals.paintPage('main', { replaceState: true });
    });
    if (!response.show) return qs('#toMain').click();
    const { tasksCount: counter, dayProgress: prog } = getElements('tasksCount', 'dayProgress');
    prog.max = response.all;
    let completedTasks = response.count;
    const updateUI = () => {
      counter.innerHTML = `${completedTasks}/${response.all}`;
      prog.value = completedTasks;
    };
    const completeDay = async (actualDay) => {
      actualDay.completed = completedTasks == response.all;
      actualDay.completedTasks = completedTasks;
      await globals.db.setItem('days', actualDay);
    };
    updateUI();
    if (response.completed) {
      qsa('.completed').forEach(show);
      qsa('.content > *:not(.completed)').forEach(hide);
      page.classList.add('center', 'doubleColumns');
      qs('#congrats').innerHTML += counter.parentElement.innerHTML;
      return;
    }
    const container = qs('#tasks.forgotten');
    for (let elem of qsa('.forgotten')) {
      elem.style.display = 'flex';
    }
    for (let id of day.forgottenTasks) {
      const td = await globals.db.getItem('tasks', id);
      renderTask({
        type: 'day', globals, td, extraFunc: async (actualDay, value) => {
          completedTasks += 1 * (value ? 1 : -1);
          await completeDay(actualDay);
          updateUI();
        }, page: container, forcedDay: date
      });
    }
  }
};
