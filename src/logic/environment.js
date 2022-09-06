export function checkForFeatures(features) {
  let elem = document.createElement('div');
  for (let feat of features) {
    window.dailerData[feat] = feat in elem;
  }
  elem.remove();
  elem = null;
}

export function isDesktop() {
  if (navigator.userAgentData) return !navigator.userAgentData.mobile;
  if ('standalone' in navigator) return false;
  return window.matchMedia('(pointer: fine) and (hover: hover)').matches;
}

function mediaQuery(query) { return window.matchMedia(query).matches; }
export const isWideInterface = () => mediaQuery('(min-width: 470px)');
export const isDoubleColumns = () => mediaQuery('(min-width: 935px) and (orientation: landscape)');

function getPlatform() {
  const { userAgent, platform } = navigator;
  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  let os;

  if (macosPlatforms.indexOf(platform) !== -1) os = 'macOS';
  else if (iosPlatforms.indexOf(platform) !== -1) os = 'iOS';
  else if (windowsPlatforms.indexOf(platform) !== -1) os = 'Windows';
  else if (/Android/.test(userAgent)) os = 'Android';
  else if (/Linux/.test(platform)) os = 'Linux';

  return os;
}

export const platform = getPlatform();
export const isMacOS = platform === 'macOS';
export const isIOS = platform === 'iOS';
//export const isAndroid = platform === 'Android';
export const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);// || 'standalone' in navigator;
