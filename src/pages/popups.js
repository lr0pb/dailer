import { downloadData } from './highLevel/createBackup.js'

export const popups = {
  downloadBackup: (globals) => {
    return {
      emoji: emjs.box,
      text: 'Download your data backup?',
      strictClosing: true,
      action: async () => {
        const link = await downloadData(globals);
        link.click();
      }
    };
  },
  uploadBackup: (globals) => {
    return {
      emoji: emjs.box,
      text: 'Uploading backups in this way will be supported later',
      action: globals.closePopup
    };
  }
};
