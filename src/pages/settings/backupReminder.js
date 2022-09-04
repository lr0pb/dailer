import { globQs as qs, createOptionsList, togglableElement } from '../highLevel/utils.js'
import { renderToggler, toggleFunc, getTextDate } from '../highLevel/taskThings.js'
import { getToday, oneDay } from '../highLevel/periods.js'

export async function addBackupReminder(globals) {
  const remind = await globals.db.getItem('settings', 'backupReminder');
  const value = remind.value ? 1 : 0;
  togglableElement(qs('#reminderInfo'), value ? 'showing' : 'hided');
  renderToggler({
    name: `${emjs.alarmClock} Remind me`, id: 'reminder', buttons: [{
      emoji: emjs[value ? 'sign' : 'blank'],
      func: onReminderClick, args: { globals }
    }], page: qs('#reminder'), value
  });
  qs('#reminderList').addEventListener('change', async (e) => {
    const reminder = qs('[data-id="reminder"]');
    reminder.dataset.value = 1;
    reminder.children[1].innerHTML = emjs.sign;
    await onRemindIdChange(globals, e.target.value);
  });
}

export async function paintBackupReminder(globals) {
  const reminderList = await globals.getList('reminderList');
  createOptionsList(qs('#reminderList'), reminderList);
  const remind = await globals.db.getItem('settings', 'backupReminder');
  if (remind.id) qs('#reminderList').value = remind.id;
  if (!remind.value) return;
  qs('#nextRemind').innerHTML = getNextRemindText(remind.nextRemind);
  qs('#nextRemind').style.display = 'block';
}

async function onReminderClick({e, elem, globals}) {
  const value = toggleFunc({e, elem});
  if (value) {
    const remindId = qs('#reminderList').value;
    if (remindId == '0') {
      toggleFunc({e, elem});
      globals.message({ state: 'fail', text: 'Select how often to remind you first' });
    } else await onRemindIdChange(globals, remindId);
  } else {
    await globals.db.updateItem('settings', 'backupReminder', (remind) => {
      remind.value = value;
    });
    qs('#reminderInfo').setStyle('hided');
    globals.message({ state: 'success', text: 'Reminder was removed' });
  }
}

async function onRemindIdChange(globals, remindId) {
  const reminderList = await globals.getList('reminderList');
  const remind = await globals.db.updateItem('settings', 'backupReminder', (remind) => {
    remind.knowAboutFeature = true;
    remind.id = remindId;
    remind.value = reminderList[remind.id].offset * oneDay;
    remind.nextRemind = getToday() + remind.value;
    remind.isDownloaded = false;
  });
  qs('#nextRemind').innerHTML = getNextRemindText(remind.nextRemind);
  qs('#reminderInfo').setStyle('showing');
  globals.message({
    state: 'success', text: `Now you will get reminders ${reminderList[remind.id].title}`
  });
  const elem = qs('.floatingMsg[data-id="reminderPromo"]');
  if (elem) elem.remove();
}

function getNextRemindText(nextRemind) {
  if (nextRemind == getToday()) {
    return `You got reminder today`;
  }
  return `Next reminder will be ${getTextDate(nextRemind)}`;
}
