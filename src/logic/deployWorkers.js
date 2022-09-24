import { externalNavigate } from './navigation.js'
import { registerPeriodicSync } from '../pages/settings/notifications.js'

export async function deployWorkers(globals) {
  const resp = {
    worker: null, periodicSync: { support: false }
  };
  if (!('serviceWorker' in navigator && 'caches' in window)) return resp;
  await unregisterPreviousSW();
  const reg = await registerServiceWorker(globals);
  const worker = deployMainWorker();
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

function deployMainWorker() {
  const worker = new Worker('./workers/mainWorker.js');
  worker._callsList = new Map();
  worker.call = setCallListener(worker);
  worker.onmessage = (e) => {
    if (e.data.error) return showErrorPage(globals, e.data.error);
    worker._callsList.set(e.data._id, { data: e.data.data, used: false });
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
