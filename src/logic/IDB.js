export const database = {
  name: 'dailer', version: 6,
  stores: [
    { name: 'settings', index: {keyPath: 'name'} },
    { name: 'tasks', index: {keyPath: 'id'} },
    { name: 'days', index: {keyPath: 'date'} },
    { name: 'periods', index: {keyPath: 'id'} },
    { name: 'labels', index: {keyPath: 'id'} },
    { name: 'themes', index: {keyPath: 'id'} },
  ],
  settings: {
    'notifications': 1, 'periodicSync': 1, 'persistentStorage': 1,
    'backupReminder': 3, 'session': 1, 'periods': 1,
  }
};

/**
* @objectStores - array e.g. [{name: 'name', index: {keyPath: 'title'}}]
*/

export class IDB {
  constructor(name, version, objectStores) {
    if (typeof name != 'string' || typeof version != 'number' || !Array.isArray(objectStores)) {
      return console.error(`[IDB] Wrong arguments data types, can't open database`);
    }
    this._listeners = {};
    this.idb = indexedDB.open(name, version);
    this.idb.addEventListener('upgradeneeded', () => this._upgradeneeded(objectStores));
    this.idb.addEventListener('success', () => this._success());
    return this;
  }
  _upgradeneeded(objectStores) {
    console.log('[IDB] Upgradeneeded event');
    this.db = this.idb.result;
    const actualStores = {};
    for (let store of objectStores) {
      if (typeof store.name == 'string' && typeof store.index == 'object') {
        if (!this.db.objectStoreNames.contains(store.name)) {
          this.db.createObjectStore(store.name, store.index);
        }
        actualStores[store.name] = true;
      }
    };
    for (let storeName of this.db.objectStoreNames) {
      if (!actualStores[storeName]) this.db.deleteObjectStore(storeName);
    };
  }
  _success() {
    console.log('[IDB] Database successfully opened');
    this.db = this.idb.result;
    this.db.addEventListener('versionchange', () => this._versionchange());
  }
  _versionchange() {
    this.db.close();
    this._closedDueToVersionChange = true;
    console.error('[IDB] Database closed due to version change, reload page');
  }
  async _isDbReady() {
    if (this._closedDueToVersionChange) return false;
    if (!this.db) await new Promise((resolve) => {
      const isComplete = () => this.db ? resolve() : setTimeout(isComplete, 5);
      isComplete();
    });
    return true;
  }
  _err(name, store) { return `[IDB] Error in db.${name}(${store || ' '}): `; }
  _checkStore(name, store) {
    if (!this.db.objectStoreNames.contains(store)) {
      console.error(`${this._err(name)}database haven't "${store}" store`);
      return false;
    }
    return true;
  }
  _argsCheck(name, args) {
    let store = null;
    for (let argName in args) {
      const arg = args[argName];
      if (argName == 'store') {
        store = arg.value;
        Object.assign(arg, { required: true, type: 'string' });
      }
      if (!arg.required && !arg.value) continue;
      if (arg.required && !arg.value) return console.error(`${this._err(name, store)}waited for ${argName} argument but receives nothing`);
      if (arg.type && typeof arg.value !== arg.type) return console.error(
        `${this._err(name, store)}waited for ${argName} argument type ${arg.type} but receives type ${typeof arg.value}: ${arg.value}`
      );
    }
    return true;
  }
  async _dbCall(name, args, mode, action, actionArgument, onResult, onSuccess) {
    if (!this._argsCheck(name, args)) return;
    const isReady = await this._isDbReady();
    if (!isReady) return;
    const store = args.store.value;
    if (!this._checkStore(name, store)) return;
    const actioner = this.db
      .transaction(store, mode)
      .objectStore(store)
      [action](actionArgument);
    return new Promise((resolve) => {
      actioner.addEventListener('success', async () => {
        const complete = onSuccess ? await onSuccess(actioner.result) : true;
        if (complete) resolve(onResult ? onResult(actioner.result) : null);
      });
    });
  }
/**
* @item - object e.g. {title: 'title', author: 'name', data: new ArrayBuffer(32)}
*/
  async setItem(store, item) {
    const resp = await this._dbCall('setItem', {
      store: { value: store }, item: { value: item, required: true, type: 'object' }
    }, 'readwrite', 'put', item, () => {
      if (store in this._listeners) {
        this._listeners[store].map((callback) => callback(store, item));
      }
    });
    return resp;
  }
  async getItem(store, itemKey) {
    const resp = await this._dbCall('getItem', {
      store: { value: store }, itemKey: { value: itemKey, required: true }
    }, 'readonly', 'get', itemKey, (result) => result);
    return resp;
  }
/**
* @updateCallback(item) - async function that receive item and can change fields in them
*/
  async updateItem(store, itemKey, updateCallback) {
    if (!this._argsCheck('updateItem', {
      store: { value: store }, itemKey: { value: itemKey, required: true },
      updateCallback: { value: updateCallback, required: true, type: 'function' }
    })) return;
    const data = await this.getItem(store, itemKey);
    await updateCallback(data);
    await this.setItem(store, data);
    return data;
  }
/**
* @onData(item, index) - async function that calls every time when new store item is received
*/
  async getAll(store, onData) {
    const items = [];
    const resp = await this._dbCall('getAll', {
      store: { value: store }, onData: { value: onData, type: 'function' }
    }, 'readonly', 'openCursor', null, null, async (result) => {
      if (result) {
        const value = result.value;
        const index = items.length;
        items.push(value);
        if (onData) await onData(value, index);
        result.continue();
      } else return true;
    });
    return resp ? items : resp;
  }
  async deleteItem(store, itemKey) {
    const resp = await this._dbCall('deleteItem', {
      store: { value: store }, itemKey: { value: itemKey, required: true }
    }, 'readwrite', 'delete', itemKey);
    return resp;
  }
  async deleteAll(store) {
    const resp = await this._dbCall('deleteAll', {
      store: { value: store }
    }, 'readwrite', 'clear');
    return resp;
  }
/**
* @hasItem(store, itemKey?) - if no itemKey provided - return items count in this store
*/
  async hasItem(store, itemKey) {
    const resp = await this._dbCall('hasItem', {
      store: { value: store }
    }, 'readonly', 'count', itemKey, (result) => itemKey ? (result == 1 ? true : false) : result);
    return resp;
  }
/**
* @callback(store, item) - async function that calls every time when some items updated in store
*/
  async onDataUpdate(store, callback) {
    if (!this._argsCheck('updateItem', {
      store: { value: store }, callback: { value: callback, required: true, type: 'function' }
    })) return;
    const isReady = await this._isDbReady();
    if (!isReady) return;
    if (!this._checkStore('onDataUpdate', store)) return;
    if (!(store in this._listeners)) this._listeners[store] = [];
    this._listeners[store].push(callback);
    return this;
  }
};
