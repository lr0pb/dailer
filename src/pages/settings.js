import { renderToggler, toggleFunc } from '../ui/toggler.js'
import { globQs as qs } from '../utils/dom.js'
import { uploadData } from './highLevel/uploadBackup.js'
import { downloadData } from './highLevel/createBackup.js'
import { toggleExperiments } from './highLevel/settingsBackend.js'
import { paintPeriods } from './settings/periods.js'
import { addBackupReminder, paintBackupReminder } from './settings/backupReminder.js'
import { addNotifications, toggleNotifReason } from './settings/notifications.js'

export const settings = {
  get title() { return `${emjs.box} Settings`},
  sections: ['periods', 'manageData', 'notifications', 'about'],
  fillHeader: ({page}) => {
    page.innerHTML = `
      <h1>${settings.title}</h1>
      <button id="closeSettings" class="emojiBtn" title="Close settings" aria-label="Close settings">
        ${emjs.cross}
      </button>
    `;
    qs('#closeSettings').addEventListener('click', () => history.back());
  },
  paint: async ({globals, page}) => {
    page.innerHTML = `
      <div id="firstTimeOpeningIdentifier"></div>
      <h2 data-section="periods">Periods</h2>
      <h3 id="periodsText"></h3>
      <div id="periodsContainer" class="first doubleColumns" focusgroup></div>
      <h3>Create your own periods for specific task performance</h3>
      <button id="toPeriodCreator">${emjs.calendar} Create custom period</button>
      <h2 data-section="manageData">Data management</h2>
      <div class="floatingMsg notFixed">
        <h3>${emjs.lockWKey} Your data is stored on your device & can't be remotely accessed</h3>
      </div>
      <div class="doubleColumns">
        <div class="content">
          <h3>
            <!--Backups are using for be safe and prevent accidental data deletion or for transfer it to other device. -->
            Upload existent backup to this device or back up your current data
          </h3>
          <button id="uploadData" class="beforeUpload">${emjs.crateUp} Upload existent backup</button>
          <h3 class="beforeUpload">Only <strong>.dailer</strong> files accepted</h3>
          <input type="file" accept=".dailer" id="chooseFile" disabled aria-hidden="true">
          <progress class="uploadUI"></progress>
          <h3 class="uploadUI">Be patient and don't quit the app before uploading is done</h3>
          <h2 class="uploadSuccess emoji">${emjs.sign}</h2>
          <h3 class="uploadSuccess">Upload successfully completed, go back to check the tasks</h3>
          <button id="getData" class="success">${emjs.crateDown} Backup your current data</button>
          <progress class="downloadUI"></progress>
          <a id="downloadData" class="downloadLink" download="" aria-hidden="true"></a>
        </div>
        <div>
          <h3>Set up a reminder to create backups periodically. You will able to download it just from app's main screen</h3>
          <div id="reminderInfo">
            <select id="reminderList" title="Select how often to remind you about creating backups"></select>
            <h3 id="nextRemind">Next remind</h3>
          </div>
          <div id="reminder" class="first"></div>
        </div>
      </div>
      <style class="notifStyle"></style>
      <h2 data-section="notifications" class="notif">Notifications</h2>
      <h3 class="notif">Turn on notifications about in-app activities to improve task management</h3>
      <div class="floatingMsg notFixed notif">
        <h3>${emjs.paperList} Notifications will arrive in a bundle only once a day</h3>
      </div>
      <div class="doubleColumns first notif">
        <div id="notifications"></div>
        <button id="install" class="notifNotAllowed">${emjs.crateDown} Install dailer</button>
      </div>
      <h3 id="notifReason" class="notif"></h3>
      <div id="notifTopics" class="doubleColumns first notif" focusgroup></div>
      <div id="experiments"></div>
      <button id="toDebug" class="secondary">${emjs.construction} Open debug page</button>
      <h2 data-section="about">About</h2>
      <h3>${emjs.label} dailer app, version {VERSION}</h3>
      <h3 id="emojiCredit">${emjs.sparkles} Emojis powered by <a href="https://github.com/googlefonts/noto-emoji/" target="_blank">Google</a></h3>
      <!--<h3>${emjs.magicBall} Codename: Sangria</h3>-->
      <h3>${emjs.microscope} Developed in 2022</h3>
      <div class="doubleColumns first">
        <button id="share">${emjs.loudspeaker} Share dailer</button>
      </div>
    `;
    if (dailerData.isIOS || dailerData.isMacOS) qs('#emojiCredit').remove();
    qs('#toPeriodCreator').addEventListener('click', () => {
      globals.closeSettings();
      globals.paintPage('periodCreator');
    });
    qs('#toDebug').addEventListener('click', () => {
      globals.closeSettings();
      globals.paintPage('debugPage');
    });
    if (!navigator.share) {
      qs('#share').parentElement.remove();
    } else qs('#share').addEventListener('click', () => {
      navigator.share({
        title: 'dailer \u{2705}',
        text: 'Check what is the dailer \u{1f642}',
        url: location.origin + location.pathname
      }).catch((err) => {
        console.log('Share was cancelled');
      });
    });
    qs('#uploadData').addEventListener('click', async () => {
      await uploadData(globals, paintPeriods);
    });
    qs('#getData').addEventListener('click', async () => {
      const link = await downloadData(globals);
      link.click();
    });
    await addBackupReminder(globals);
    renderToggler({
      name: `${emjs.experiments} Enable experiments`, id: 'experiments', buttons: [{
        emoji: emjs[dailerData.experiments ? 'sign' : 'blank'],
        func: async ({e, elem}) => {
          dailerData.experiments = toggleFunc({e, elem});
          await globals.db.update('settings', 'session', (session) => {
            session.experiments = dailerData.experiments;
          });
          globals.message({
            state: 'success', text: 'You need to reload app so all experiments will take effect'
          });
          toggleExperiments();
        }
      }], page: qs('#experiments'), value: dailerData.experiments
    });
  },
  opening: async ({globals}) => {
    const isFirstOpening = qs('#firstTimeOpeningIdentifier') ? true : false;
    if (isFirstOpening) qs('#firstTimeOpeningIdentifier').remove();
    const toRender = {
      periodsContainer: paintPeriods,
      reminderList: paintBackupReminder,
    };
    for (let elem in toRender) {
      if (!qs(`#${elem}`).children.length) await toRender[elem](globals);
    }
    if (isFirstOpening) await addNotifications(globals);
    if (qs('#install').dataset.installed == 'true') {
      const session = await globals.db.get('settings', 'session');
      toggleNotifReason(session, null, globals);
    }
  }
};
