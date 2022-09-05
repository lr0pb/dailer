import { qs, qsa } from './highLevel/utils.js'
import { installApp } from './main.js'

export const onboarding = {
  get title() { return `${emjs.sparkles} Welcome to the dailer ${emjs.sign}`},
  titleEnding: 'none',
  get header() { return ''},
  get page() { return `
    <div class="content center" data-stage="0">
      <!--<div id="onboardingBg"></div>-->
      <div class="content center doubleColumns">
        <h2 class="emoji">${emjs.sparkles}</h2>
        <h2>Welcome to the dailer</h2>
        <h3>Plan tasks for the day and analyze how you grow yourself over time</h3>
      </div>
    </div>
    <div class="content center doubleColumns" data-stage="1">
      <h2 class="emoji">${emjs[dailerData.isDesktop ? 'desktop' : 'phone']}</h2>
      <h2>Install dailer</h2>
      <h3>You can choose to run dailer in browser or install it to homescreen</h3>
    </div>
    <div class="content center doubleColumns safari" data-stage="2">
      <h2 class="emoji">${emjs.warning}</h2>
      <h2>Sure to use in Safari?</h2>
      <h3>If you use dailer via Safari and will be inactive for 7 days, all your data will be deleted due to Apple restrictions</h3>
    </div>
  `},
  styleClasses: 'slider',
  noSettings: true,
  get footer() { return `
    <button id="skip" class="secondary noEmoji hidedUI">Skip</button>
    <button id="action" data-stage="0">${emjs.sword} Start dailer</button>
  `},
  script: ({globals, page}) => {
    const action = qs('#action');
    const setStage = (stage, title) => {
      action.dataset.stage = stage;
      action.innerHTML = title;
      qs(`div[data-stage="${stage}"]`).scrollIntoView({ behavior: 'smooth' });
    };
    if (!dailerData.isSafari) qsa('.safari').forEach((el) => el.remove());
    action.addEventListener('click', async () => {
      const session = await globals.db.getItem('settings', 'session');
      if (!session.installed && dailerData.isSafari) {
        if (action.dataset.stage == '0') {
          action.classList.add('secondary');
          setStage(1, `${emjs.forward} Continue in Safari`);
          return globals.floatingMsg({
            id: 'installIOS', pageName: 'onboarding',
            text: `${emjs.crateUp} Click "Share" > "Install to the homescreen". Then close Safari and open dailer as regular app`
          });
        } else if (action.dataset.stage == '1') {
          action.classList.add('danger');
          return setStage(2, `${emjs.forward} Confirm to use Safari`);
        }
      } else if (!session.installed) {
        if (action.dataset.stage == '0') {
          if (globals.installPrompt) {
            setStage(1, `${emjs.crateDown} Install and proceed`);
            return qs('#skip').classList.remove('hidedUI');
          }
        } else if (action.dataset.stage == '1') {
          const resp = await installApp(globals);
          if (!resp) return;
        }
      }
      await onboard(globals);
    });
    qs('#skip').addEventListener('click', async () => await onboard(globals));
  }
};

async function onboard(globals) {
  await globals.db.updateItem('settings', 'session', (session) => {
    session.onboarded = true;
  });
  await globals.paintPage('taskCreator', { dontPushHistory: true });
}
