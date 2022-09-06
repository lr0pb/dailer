import { qs } from './highLevel/utils.js'

export const reloaded = {
  get title() { return `${emjs.construction} dailer technical info page`},
  titleEnding: 'none',
  get header() { return ''},
  noSettings: true,
  styleClasses: 'center',
  get page() { return `
    <h2 class="emoji">${emjs.light}</h2>
    <h2>dailer was reloaded</h2>
  `},
  get footer() { return `
    <button id="back">${emjs.salute} Thanks for info</button>
  `},
  script: () => {
    qs('#back').addEventListener('click', () => history.back());
  }
};
