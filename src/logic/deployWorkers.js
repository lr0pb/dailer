import { externalNavigate } from './navigation.js'
import { registerPeriodicSync } from '../pages/settings/notifications.js'
import { showErrorPage } from '../utils/appState.js';

export async function deployWorkers(globals) {
  const resp = {
    worker: null, periodicSync: { support: false }
  };
  if (!('serviceWorker' in navigator && 'caches' in window)) return resp;
  await unregisterPreviousSW();
  const reg = await registerServiceWorker(globals);
  const worker = deployWorker('./workers/mainWorker.js');
  resp.worker = worker;
  if (!('permissions' in navigator)) return resp;
  const isPeriodicSyncSupported = 'periodicSync' in reg;
  resp.periodicSync.support = isPeriodicSyncSupported;
  if (!isPeriodicSyncSupported) return resp;
  resp.periodicSync.permission = await registerPeriodicSync(reg);
  return resp;
}

async function unregisterPreviousSW() {
  if (window.opener) window.opener.close();
  const regs = await navigator.serviceWorker.getRegistrations();
  for (let reg of regs) {
    if (!reg.active.scriptURL.includes('/tools')) continue;
    await reg.unregister();
  }
}

async function registerServiceWorker(globals) {
  const reg = await navigator.serviceWorker.register('./sw.js');
  navigator.serviceWorker.onmessage = async (e) => {
    if (typeof e.data !== 'object') return;
    await externalNavigate(globals, e.data.navigate);
  };
  if ('launchQueue' in window && 'targetURL' in LaunchParams.prototype) {
    launchQueue.setConsumer(async (launchParams) => {
      await externalNavigate(globals, launchParams.targetURL);
    });
  }
  return reg;
}

function deployWorker(url) {
  const worker = new Worker(url);
  worker._callsList = new Map();
  worker._eventListeners = {};
  worker.call = setCallListener(worker);
  worker.listen = setWorkerListening(worker);
  worker.onmessage = async (e) => {
    const response = e.data;
    if (response.error) return showErrorPage(globals, response.error);
    if (response.event) {
      await onWorkerEvent(worker, response);
      return;
    }
    worker._callsList.set(response._id, { data: response.data, used: false });
  };
  worker.postMessage({isWorkerReady: false});
  return worker;
}

function setCallListener(worker) {
  return async (call = {}) => {
    for (let [key, value] of worker._callsList) {
      if (value.used) worker._callsList.delete(key);
    }
    if (typeof call !== 'object') return;
    call._id = Date.now();
    worker.postMessage(call);
    await new Promise((res) => {
      const isReady = () => {
        worker._callsList.has(call._id) ? res() : requestAnimationFrame(isReady);
      };
      isReady();
    });
    const resp = worker._callsList.get(call._id);
    resp.used = true;
    return resp.data;
  };
}

function setWorkerListening(worker) {
  return (event, listener) => {
    if (typeof event !== 'string') return;
    if (typeof listener !== 'function') return;
    if (!worker._eventListeners[event]) {
      worker._eventListeners[event] = {};
    }
    const id = Date.now();
    worker._eventListeners[event][id] = listener;
    return () => {
      delete worker._eventListeners[event][id];
    };
  };
}

async function onWorkerEvent(worker, response) {
  const eventStorage = worker._eventListeners[response.event];
  if (!eventStorage) return;
  for (const listenerId in eventStorage) {
    await eventStorage[listenerId](response.data);
  }
}
