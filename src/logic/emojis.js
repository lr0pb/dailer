import { globQs } from '../utils/dom'

export async function enableEmojis(globals) {
  const timeLog = performance ? {
    json: performance.now(),
    images: null,
  } : {};
  const resp = await fetch('./emoji.json');
  window._emojiList = await resp.json();
  if (performance) {
    timeLog.json = performance.now() - timeLog.json;
    timeLog.images = performance.now();
  }
  const isAppleEmoji = await setEmojiLoad(globals);
  if (performance) {
    timeLog.images = performance.now() - timeLog.images;
    console.log(timeLog);
  }
  window.emjs = new Proxy({}, {
    get(target, prop) {
      if (!(prop in _emojiList)) return '';
      const html = `&#x${_emojiList[prop]};`;
      if (isAppleEmoji) return html;
      const style = `background-image: url(${getEmojiLink(prop)});`;
      return `<span class="emojiSymbol" style="${style}">${html}</span>`;
    }
  });
  window.hasEmoji = (elem) => typeof elem == 'string' ? elem.includes('emojiSymbol') : undefined;
}

function getEmojiLink(emoji) {
  return `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/svg/emoji_u${
    _emojiList[emoji]
  }.svg`;
}

async function setEmojiLoad(globals) {
  const isAppleEmoji = dailerData.isIOS || dailerData.isMacOS;
  const session = await globals.db.getItem('settings', 'session');
  const isDiffVersions = window._emojiList.lastModified !== session.emojiLastModified;
  session.emojiLastModified = window._emojiList.lastModified;
  await globals.db.setItem('settings', session);
  if (!isAppleEmoji && isDiffVersions) {
    globQs('#loadingText').innerHTML = `Loading updated assets...`;
    await loadEmojis();
  }
  delete window._emojiList.lastModified;
  return isAppleEmoji;
}

async function loadEmojis() {
  const loadArray = [];
  for (let name in window._emojiList) {
    if (name == 'lastModified') continue;
    const link = getEmojiLink(name);
    loadArray.push(fetch(link));
  }
  await Promise.all(loadArray);
}
