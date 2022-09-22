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
      text: 'Upload your backup',
      description: 'Uploading backups through opening file will be available later',
      action: globals.closePopup
    };
  }
};
