import {
  qs as localQs, globQs as qs, inert, show, hide
} from '../utils/dom.js'

export function message({state, text}) {
  const msg = qs('#message');
  msg.classList.add('animate');
  msg.style.setProperty('--color', state == 'fail' ? '#a30000' : '#008000');
  msg.innerHTML = `${emjs[state == 'fail' ? 'cross' : 'sign']} ${text}`;
  setTimeout( () => { msg.classList.remove('animate') }, 3000);
}

export function openPopup(globals, {emoji, text, description, action, strictClosing}) {
  const popup = qs('#popup');
  if (strictClosing) popup.classList.add('strictClosing');
  popup.style.visibility = 'visible';
  inert.set(qs(globals.settings ? '#settings' : '.current'));
  inert.remove(popup, popup.querySelector('[data-action="cancel"]'));
  qs('#popup h2.emoji').innerHTML = emoji;
  qs('#popup h2:not(.emoji)').innerHTML = text;
  if (description) {
    show('#popup h3', description, true);
  } else {
    hide('#popup h3', true);
  }
  popup.querySelector('[data-action="confirm"]').onclick = async () => {
    await action();
    globals.closePopup();
  };
  requestAnimationFrame(() => {
    popup.ontransitionend = null;
    popup.classList.add('showPopup');
    popup.querySelector('div').style.transitionTimingFunction = 'ease';
  });
}

export function closePopup(globals, dontImpactToNavigation) {
  const popup = qs('#popup');
  inert.remove(qs(globals.settings ? '#settings' : '.current'));
  inert.set(popup);
  popup.classList.remove('showPopup', 'strictClosing');
  popup.style.visibility = 'hidden';
  if (popup.hasAttribute('style')) popup.ontransitionend = () => {
    popup.ontransitionend = null;
    popup.querySelector('div').removeAttribute('style');
  };
  qs('[data-action="confirm"]').onclick = null;
  if (dontImpactToNavigation) return;
  const link = location.href.replace(/&popup=\w+/, '');
  dailerData.nav
  ? navigation.navigate(link, {
      state: globals.pageInfo || navigation.currentEntry.getState() || {},
      history: 'replace', info: {call: 'customReplace'}
    })
  : history.replaceState(globals.pageInfo || history.state || {}, '', link);
}

export function floatingMsg(globals, {
  id, text, button, longButton, onClick, pageName, notFixed
}) {
  const prevElem = localQs('.floatingMsg', pageName);
  if (prevElem) prevElem.remove();
  const elem = document.createElement('div');
  if (id) elem.dataset.id = id;
  const useLong = longButton && dailerData.isWideInterface;
  elem.className = `floatingMsg ${notFixed ? 'notFixed' : ''}`;
  elem.innerHTML = `
    <h3>${text}</h3>
    ${button
      ? `<button class="${useLong ? '' : 'noEmoji'}" style="${
        useLong ? 'display: inline-flex; align-items: center;' : ''
      }">${useLong ? longButton : button}</button>`
      : ''}
  `;
  const content = localQs('.content', pageName);
  content.append(elem);
  if (button && onClick) {
    localQs('.floatingMsg button', pageName).addEventListener('click', onClick);
  }
  if (!content.classList.contains('center')) {
    addFloatingDiv(globals, elem, content);
  }
  return elem;
}

function addFloatingDiv(globals, elem, content) {
  const existentDiv = localQs('.floatingDiv');
  const div = existentDiv || document.createElement('div');
  if (!existentDiv) div.className = 'floatingDiv';
  div.style.minHeight = `${elem.getBoundingClientRect().height}px`;
  if (!existentDiv) {
    const isReady = () => {
      if (globals.isPageReady) return content.append(div);
      setTimeout(isReady, 10);
    };
    isReady();
  }
}
