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

export { IDB } from '../../../IDB.js/out/IDB.module.js' // import IDB from lr0pb/IDB.js repository
