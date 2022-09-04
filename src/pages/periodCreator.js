import { renderToggler, toggleFunc } from './highLevel/taskThings.js'
import {
  qs, qsa, globQs, globQsa, /*emjs,*/ safeDataInteractions, handleKeyboard,
  togglableElement, syncGlobals, copyArray, hide, getValue
} from './highLevel/utils.js'
import { paintPeriods } from './settings/periods.js'

const maxDays = 7;
let periodTitle = null;

export const periodCreator = {
  get title() {
    return `${emjs.calendar} ${
      periodTitle ? `Edit period: ${periodTitle}` : 'Create new period'
    }`;
  },
  get titleEnding() { return periodTitle ? 'line' : 'text'; },
  dynamicTitle: true,
  get header() { return `${emjs.calendar} <span id="periodAction">Create</span> period`},
  get page() { return `
    <h3>Enter period title</h3>
    <input type="text" id="periodName" placeHolder="Period title e.g 'Every friday'">
    <h3>You also can type period description</h3>
    <input type="text" id="periodDesc" placeHolder="Period description">
    <h3 class="excludeInEdit">How much days will be in period?</h3>
    <input type="range" id="daysCount" class="excludeInEdit" min="1" max="${maxDays}" value="${maxDays}">
    <h3 class="excludeInEdit">Select the days you need to perform the task</h3>
    <h3 class="excludeInEdit">At least one selected day is required</h3>
    <div>
      <div class="historyMonth" focusgroup="horizontal"></div>
    </div>
    <div class="togglerContainer first"></div>
    <h3 class="excludeInEdit">When period is over, it will repeat again</h3>
    <div class="togglerContainer first"></div>
    <h3 class="excludeInEdit">Period days will be linked to week days<!--, no matter when you start task with this period--></h3>
    <div class="togglerContainer first"></div>
    <h3>This period will be selected by default when you creating new tasks</h3>
  `},
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="savePeriod" class="success">${emjs.save} Save period</button>
  `},
  noSettings: true,
  script: onPeriodCreator,
  onBack: (globals) => {
    delete globals.pageInfo.periodAction;
    delete globals.pageInfo.periodId;
  }
};

function toggleDays(value) {
  const hm = qs('.historyMonth:last-child');
  for (let elem of hm.children) { elem.toggleStyle(); }
}

async function onPeriodCreator({globals, page, params}) {
  qs('#back').addEventListener('click', () => history.back());
  syncGlobals(globals);
  periodTitle = null;
  if (params.id) globals.pageInfo.periodId = params.id;
  let isEdit = params.id || globals.pageInfo.periodAction == 'edit';
  let per;
  if (isEdit) {
    per = await globals.db.getItem('periods', globals.pageInfo.periodId);
    if (!per) isEdit = false;
  }
  if (isEdit) {
    periodTitle = per.title;
    qs('#periodAction').innerHTML = 'View and edit';
    qs('#periodName').value = per.title;
    if (per.description) qs('#periodDesc').value = per.description;
    qs('#daysCount').value = per.days.length;
    qs('#daysCount').setAttribute('disabled', 'disabled');
    qsa('.excludeInEdit').forEach(hide);
    for (let elem of qsa('.togglerContainer')) {
      elem.classList.remove('first');
    }
    qs('.historyMonth:last-child').style.margin = '1rem 0';
  }
  appendDays(isEdit ? per.days : undefined, isEdit ? per.getWeekStart : undefined);
  if (isEdit) toggleDays(per.getWeekStart ? 1 : 0);
  const daysCount = qs('#daysCount');
  daysCount.addEventListener('input', onDaysCountChange);
  const containers = qsa('.togglerContainer');
  renderToggler({
    name: 'Period will be looped', id: 'isRepeatable',
    toggler: isEdit ? emjs[per.special == 'oneTime' ? 'blank' : 'sign'] : emjs.sign,
    page: containers[0], value: isEdit ? (per.special == 'oneTime' ? 0 : 1) : 1, disabled: isEdit
  });
  renderToggler({
    name: 'Week linked period', id: 'getWeekStart',
    page: containers[1], value: isEdit ? (per.getWeekStart ? 1 : 0) : 0,
    buttons: [{
      emoji: isEdit ? emjs[per.getWeekStart ? 'sign' : 'blank'] : emjs.blank,
      func: ({e, elem}) => {
        const value = toggleFunc({e, elem});
        if (value) {
          daysCount.value = maxDays;
          onDaysCountChange({ target: daysCount });
          daysCount.setAttribute('disabled', '');
        } else daysCount.removeAttribute('disabled');
        toggleDays(value);
      }
    }], disabled: isEdit
  });
  renderToggler({
    name: 'Default period', id: 'selected',
    toggler: isEdit ? emjs[per.selected ? 'sign' : 'blank'] : emjs.blank,
    page: containers[2], value: isEdit ? (per.selected ? 1 : 0) : 0
  });
  safeDataInteractions(['periodName', 'periodDesc', /*'daysCount'*/]);
  qs('#savePeriod').addEventListener('click', async () => {
    const period = await createPeriod(globals, per, isEdit);
    if (period == 'error') return globals.message({
      state: 'fail', text: 'Fill all fields'
    });
    globals.db.setItem('periods', period);
    globals.message({ state: 'success', text: `Period ${isEdit ? 'edited' : 'created'}` });
    await globals.checkPersist();
    await paintPeriods(globals);
    if (isEdit) {
      const titles = globQsa(`.customTitle[data-period="${period.id}"]`);
      for (let title of titles) { title.innerHTML = period.title; }
    }
    globals.additionalBack = 0;
    if (globals.pageInfo && globals.pageInfo.periodPromo) {
      globQs('.floatingMsg[data-id="periodPromo"]').remove();
      delete globals.pageInfo.periodPromo;
    }
    history.back();
  });
}

function appendDays(originalDays, getWeekStart) {
  const hm = qs('.historyMonth:last-child');
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = originalDays ? copyArray(originalDays) : undefined;
  if (days && getWeekStart) {
    days.push(days[0]);
    days.shift();
  }
  const daysCount = days ? days.length : maxDays;
  for (let i = 0; i < daysCount; i++) {
    const elem = document.createElement('div');
    elem.dataset.used = 'true';
    elem.dataset.value = days ? days[i] : '0';
    if (days) elem.setAttribute('disabled', '');
    if (!days) {
      elem.setAttribute('role', 'button');
      elem.tabIndex = dailerData.focusgroup ? (i == 0 ? 0 : -1) : 0;
    }
    elem.innerHTML += `
      <h4>${days ? emjs[days[i] ? 'sign' : 'blank'] : emjs.blank}</h4><h3>${dayNames[i]}</h3>
    `;
    togglableElement(elem, 'hided');
    hm.append(elem);
  }
  if (days) return;
  hm.addEventListener('click', (e) => {
    const elem = e.target.dataset.value
    ? e.target : ['H4', 'H3'].includes(e.target.tagName)
    ? e.target.parentElement : e.target.tagName == 'SPAN'
    ? e.target.parentElement.parentElement : null;
    if (!(elem.dataset && elem.dataset.value)) return;
    const value = Number(elem.dataset.value) == 1 ? 0 : 1;
    elem.dataset.value = value;
    elem.children[0].innerHTML = value ? emjs.sign : emjs.blank;
  });
  handleKeyboard(hm);
}

function onDaysCountChange(e) {
  const value = e.target.value;
  const rects = qsa('.historyMonth:last-child > div');
  for (let i = 0; i < maxDays; i++) {
    rects[i].dataset.used = i < value ? 'true' : 'false';
  }
}

export async function createPeriod(globals, per = {}, isEdit) {
  let periodData;
  if (!isEdit) periodData = await globals.db.getItem('settings', 'periods');
  const period = {
    id: isEdit ? per.id : String(periodData.lastId + 1),
    title: qs('#periodName') ? qs('#periodName').value : per.title,
    days: per.days || [], periodDay: -1, selectTitle: 'Select day to start'
  };
  const rects = qsa('.historyMonth:last-child > [data-used="true"]');
  if (!per.days) for (let elem of rects) {
    period.days.push(Number(elem.dataset.value));
  }
  if (per.title) {
    const fields = ['description', 'special', 'getWeekStart', 'selected'];
    for (let field of fields) {
      if (per[field]) period[field] = per[field];
    }
  } else {
    if (!getValue('isRepeatable')) period.special = 'oneTime';
    if (getValue('getWeekStart')) period.getWeekStart = true;
  }
  if (!per.days && period.getWeekStart) {
    period.days.unshift(period.days.at(-1));
    period.days.pop();
  }
  if (isEdit || !per.title) {
    if (qs('#periodDesc').value !== '') period.description = qs('#periodDesc').value;
    else if (period.description) delete period.description;
    if (getValue('selected')) period.selected = true;
    else if (period.selected) delete period.selected;
  }
  console.log(period);
  if (period.title == '' || !period.days.includes(1)) return 'error'
  if (!isEdit) {
    periodData.lastId++;
    await globals.db.setItem('settings', periodData);
  }
  return period;
}
