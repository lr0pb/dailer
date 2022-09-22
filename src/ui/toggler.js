import { handleKeyboard, convertEmoji } from '../utils/dom';
/**
 * renderToggler
 * @param {TogglerOptions} togglerOptions Options for create toggler element
 * 
 * @typedef {Object} TogglerOptions
 * @property {string} name Text of toggler block, required if no body passed
 * @property {string} [body] HTML string, will render instead name
 * @property {string} id Reach toggler elem via [data-id="id"] selector
 * @property {Button[]} [buttons] Array of buttons, that will appear to toggler
 * @property {string} [toggler] Emoji, received via emjs call, that will be shown on elem first render, and if it presents - add toggle functionality for last button
 * @property {1 | 0} [value] Require if toggler prop presents, represent first toggle value
 * @property {ButtonCallBack} [onBodyClick] Function that calls when click on toggler body
 * @property {object} [args] Arguments that will be passed to the onBodyClick callback
 * @property {HTMLElement} [page] Element that will be container for toggler
 * @property {boolean} [first] Should toggler have first class (adds top margin)
 * @property {boolean} [disabled] Are buttons disabled
 * 
 * @typedef {Object} Button Options for add button to toggler element
 * @property {string} emoji Emoji for button, should be received via emjs call
 * @property {ButtonCallBack} func Function that calls on click to this button
 * @property {object} [args] Arguments that will be passed to func callback
 * @property {string} [title] String for title attribute
 * @property {string} [aria] String for aria-label attribute
 * @property {boolean} [disabled] Disable only this button
 * 
 * @callback ButtonCallBack Function that calls on toggler or button click
 * @param {CallbackOptions} options Call arguments
 * 
 * @typedef {Object} CallbackOptions
 * @property {Event} e Event object
 * @property {HTMLDivElement} elem Toggler element on which was this click
 * @property {any} [param] Any other params passed via args
 */
export function renderToggler({
  name, body, id, buttons = [], toggler, value,
  onBodyClick, args = {}, page, first, disabled
}) {
  const elem = document.createElement('div');
  elem.className = `task ${first ? 'first' : ''}`;
  elem.dataset.id = id;
  const noChilds = !page ? true : page.children.length == 0;
  if (onBodyClick) {
    elem.setAttribute('role', 'button');
    elem.tabIndex = dailerData.focusgroup ? (noChilds ? 0 : -1) : 0;
    handleKeyboard(elem, true);
  }
  elem.setAttribute('focusgroup', 'extend horizontal');
  if (toggler) buttons.push({ emoji: toggler, func: toggleFunc });
  const buttonsString = getButtons(name, buttons, disabled, noChilds && onBodyClick);
  
  elem.innerHTML = `<div>${body || `<h2>${name}</h2>`}</div>${buttonsString}`;
  elem.addEventListener('click', async (e) => {
    await onClick(e, elem, buttons, onBodyClick, args);
  });
  if (value !== undefined) elem.dataset.value = value;
  elem.activate = () => elem.querySelector('button').click();
  if (page) page.append(elem);
  return elem;
}

function getButtons(name, buttons, disabled, catchFocus) {
  let resp = ``;
  buttons.forEach((btn, i) => {
    resp += `
      <button data-action="${i}" class="emojiBtn" ${
        disabled || btn.disabled ? 'disabled ' : ''
      }title="${btn.title || 'Toggle value'}" aria-label="${
        btn.aria || `Toggle ${convertEmoji(name).replace(/"/g, `'`)} value`
      }" tabIndex="${
        dailerData.focusgroup ? (catchFocus && i == 0 ? 0 : -1) : 0
      }">${btn.emoji}</button>
    `;
  });
  return resp;
}

async function onClick(e, elem, buttons, onBodyClick, args) {
  const target = e.target.dataset.action
  ? e.target : e.target.parentElement;
  if (target.hasAttribute('disabled')) return;
  if (target.dataset.action) {
    const btn = buttons[target.dataset.action];
    if (!btn.args) btn.args = {};
    await btn.func({...btn.args, e, elem});
  } else if (onBodyClick) {
    await onBodyClick({...args, e, elem});
  }
}

export function toggleFunc({e, elem}) {
  const value = Number(elem.dataset.value) ? 0 : 1;
  elem.dataset.value = value;
  const target = e.target.dataset.action ? e.target : e.target.parentElement;
  target.innerHTML = emjs[value ? 'sign' : 'blank'];
  return value;
}
