import {
  env, database, IDB,
  getRawDate, isUnder3AM, oneDay, normalizeDate, getToday, isCustomPeriod,
  intlDate, getTextDate, setPeriodTitle
} from './workers/defaultFunctions.js'
import {
  updatePeriods, createDay, getRawDay, setDefaultPeriodTitle, disable, afterDayEnded,
  getYesterdayRecap, checkBackupReminder
} from './workers/sharedFunctions.js'
import {
  proccessNotifications, cleaning, showNotification, getDayRecap
} from './workers/notifications.js'

const APP_CACHE = 'app-06.09';
const EMOJI_CACHE = 'emoji-24.07';
const HUGE_TIMEOUT = 550;
const SMALL_TIMEOUT = 300;

let USE_CACHE_INSTEAD_NETWORL = false;

if (!('at' in Array.prototype)) {
  function at(n) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    if (n < 0 || n >= this.length) return undefined;
    return this[n];
  }
  Object.defineProperty(Array.prototype, 'at', {
    value: at, writable: true, enumerable: false, configurable: true
  });
}

async function addToCache(cacheName, fileName, onFileReceived) {
  const cache = await caches.open(cacheName);
  const resp = await fetch(`./${fileName}.json`);
  const respData = await resp.json();
  const linksToCache = onFileReceived(respData);
  await Promise.all(
    linksToCache.map(async (file) => {
      const data = await fetch(file);
      if (data.ok) await cache.put(file, data);
    })
  );
}

function getEmojiLink(emoji) {
  return `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/svg/emoji_u${
    emoji
  }.svg`;
}

function getBaseLink() {
  const path = location.pathname.replace(/[\w.]+$/, '');
  return `${location.origin}${path}`;
}

async function saveCacheOnInstall() {
  await addToCache(APP_CACHE, 'files', (data) => data);
  await addToCache(EMOJI_CACHE, 'emoji', (emojis) => {
    const emojiLinks = [];
    for (let name in emojis) {
      emojiLinks.push(getEmojiLink(emojis[name]));
    }
    return emojiLinks;
  });
}

self.addEventListener('install', (e) => {
  skipWaiting();
  e.waitUntil(saveCacheOnInstall());
});

async function updateCache() {
  const keys = await caches.keys();
  await Promise.all(
    keys.map((key) => [APP_CACHE, EMOJI_CACHE].includes(key) || caches.delete(key))
  );
}

self.addEventListener('activate', (e) => {
  clients.claim();
  e.waitUntil(updateCache());
});

function getBadResponse() {
  return new Response(new Blob(), { 'status': 400, 'statusText': 'Something goes wrong with this request' });
}

async function networkFirst(e, cacheName) {
  const fetchResponse = await addCache(e.request, cacheName);
  let cacheResponse = null;
  if (!fetchResponse || (fetchResponse && !fetchResponse.ok)) {
    cacheResponse = await caches.match(e.request, {ignoreSearch: true});
  }
  return cacheResponse || fetchResponse || getBadResponse();
}

async function cacheFirst(e, cacheName) {
  const cacheResponse = await caches.match(e.request, {ignoreSearch: true});
  let fetchResponse = null;
  if (!cacheResponse) {
    fetchResponse = await addCache(e.request, cacheName);
  }
  return cacheResponse || fetchResponse || getBadResponse();
}

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/tools')) return;
  if (e.request.url.includes('googlefonts')) {
    return e.respondWith(cacheFirst(e, EMOJI_CACHE));
  }
  if (
    e.request.url.includes('screenshots') || !e.request.url.includes(location.origin)
  ) return;
  e.respondWith(networkFirst(e, APP_CACHE));
});

async function addCache(request, cacheName) {
  if (!navigator.onLine) return null;
  if (USE_CACHE_INSTEAD_NETWORL) return null;
  let fetchResponse = null;
  const url = request.url;
  const params = url.match(/(?:\/)([\w\&=\.\?]+)$/);
  let isHTML = false;
  if (params && (!params[1].includes('.') || params[1].includes('.html')) ) {
    request = new Request(url.replace(params[1], ''));
    isHTML = true;
  }
  const ext = isHTML ? 'html' : url.match(/(?:.)([\w]+)$/)[1];
  const timeout = ['html', 'js'].includes(ext) ? HUGE_TIMEOUT : SMALL_TIMEOUT;
  try {
    const response = await Promise.race([
      new Promise((res) => {
        setTimeout(res, cacheName == EMOJI_CACHE ? 3000 : timeout);
      }),
      fetch(request)
    ]);
    if (!response && timeout == HUGE_TIMEOUT) USE_CACHE_INSTEAD_NETWORL = true;
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      fetchResponse = response;
    };
  } catch (err) {}
  return fetchResponse;
};

self.addEventListener('periodicsync', (e) => {
  console.log(e.tag);
  env.db = new IDB(database.name, database.version, database.stores);
  e.waitUntil(checkNotifications(e.tag));
});

self.addEventListener('notificationclick', (e) => {
  env.db = new IDB(database.name, database.version, database.stores);
  e.notification.close();
  e.waitUntil(openApp(e.notification));
});

self.addEventListener('notificationclose', (e) => {
  env.db = new IDB(database.name, database.version, database.stores);
  e.waitUntil(statNotification(e.notification.timestamp, 'close'));
});

async function statNotification(timestamp, field) {
  await env.db.updateItem('settings', 'notifications', (notifs) => {
    notifs.callsHistory[timestamp][field] = Date.now();
  });
}

async function checkNotifications(tag) {
  await addToCache(APP_CACHE, 'files', (data) => data);
  const notifs = await env.db.getItem('settings', 'notifications');
  const periodicSync = await env.db.getItem('settings', 'periodicSync');
  periodicSync.callsHistory.push({ timestamp: Date.now() });
  await env.db.setItem('settings', periodicSync);
  if (!notifs.enabled || notifs.permission !== 'granted') return;
  await proccessNotifications(notifs, tag);
}

async function openApp({ timestamp, data }) {
  let link = `${getBaseLink()}?from=notification`;
  for (let param in data) {
    link += `&${param}=${data[param]}`;
  }
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (allClients.length > 0) {
    allClients.at(-1).focus();
    allClients.at(-1).postMessage({ navigate: link });
  } else {
    const windowClient = await clients.openWindow(link);
    if (windowClient && !windowClient.focused) windowClient.focus();
  }
  await statNotification(timestamp, 'click');
}
