import { globQs as qs } from '../highLevel/utils.js'
import { renderToggler, toggleFunc } from '../highLevel/taskThings.js'
import { isCustomPeriod } from '../highLevel/periods.js'

const periodsCount = 5;

export async function paintPeriods(globals) {
  qs('#periodsText').innerHTML = `Select up to ${periodsCount} periods that will be shown in Period choise drop down list of task`;
  const pc = qs('#periodsContainer');
  const periods = await globals.getPeriods();
  const periodData = await globals.db.getItem('settings', 'periods');
  const editTitle = 'View or edit period';
  const markTitle = (per) => `Add period${per ? ` "${per}"` : ''} to drop down list`;
  pc.innerHTML = '';
  for (let per in periods) {
    const period = periods[per];
    const buttons = [];
    if (isCustomPeriod(period.id)) {
      buttons.push({
        emoji: emjs.pen, args: { globals },
        title: editTitle, aria: `${editTitle}: ${period.title}`,
        func: async ({globals}) => {
          if (!globals.pageInfo) globals.pageInfo = {};
          const id = period.id;
          globals.pageInfo.periodId = id;
          globals.pageInfo.periodAction = 'edit';
          globals.closeSettings();
          await globals.paintPage('periodCreator', { params: { id } });
        }
      });
    }
    const used = getPeriodUsed(periodData.list, per);
    buttons.push({
      emoji: emjs[used ? 'sign' : 'blank'], value: used,
      title: markTitle(), aria: markTitle(period.title),
      func: updatePeriodsList, args: { globals, periodsCount }
    });
    renderToggler({ name: period.title, id: period.id, page: pc, buttons });
  }
}

async function updatePeriodsList({e, globals, periodsCount, elem }) {
  const periodData = await globals.db.getItem('settings', 'periods');
  const list = periodData.list;
  const id = elem.dataset.id;
  if (list.includes(id)) {
    if (list.length == 1) {
      return globals.message({
        state: 'fail', text: `You need to have at least 1 period`
      });
    }
    const idx = list.indexOf(id);
    list.splice(idx, 1);
  } else {
    const isFull = list.length == periodsCount;
    isFull ? globals.message({
        state: 'fail', text: `You already choose ${periodsCount} periods`
      })
    : list.push(id);
    if (isFull) return;
  }
  list.sort((el1, el2) => {
    el1 = Number(el1);
    el2 = Number(el2);
    if (el1 > el2) return 1;
    if (el1 == el2) return 0;
    return -1;
  });
  await globals.db.setItem('settings', periodData);
  toggleFunc({e, elem});
}

function getPeriodUsed(periodsList, id) {
  return periodsList.includes(id) ? 1 : 0;
}
