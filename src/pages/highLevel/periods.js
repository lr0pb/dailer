export function getRawDate(date) {
  return new Date(date).setHours(0, 0, 0, 0);
}

export function isUnder3AM(date) {
  if (!date) date = new Date();
  return date.getTime() === getRawDate(date)
  ? false : date.getHours() < 3;
}

export const oneDay = 86400000; // 86 400 000 milliseconds in one day

export function normalizeDate(date) {
  if (typeof date == 'string') date = Number(date);
  date = new Date(date);
  const rawDate = getRawDate(date);
  return isUnder3AM(date) ? rawDate - oneDay : rawDate;
}

export function getToday() { // date in milliseconds
  return normalizeDate(Date.now());
}

export function convertDate(date) {
  return new Date(date).toLocaleDateString('en-ca');
}

export function intlDate(date) {
  return new Date(typeof date == 'string' ? Number(date) : date)
    .toLocaleDateString(navigator.language);
}

export function getTextDate(date) {
  let resp = intlDate(date);
  if (date == getToday()) resp = 'today';
  else if (date - oneDay == getToday()) resp = 'tomorrow';
  else if (date + oneDay == getToday()) resp = 'yesterday';
  return resp;
}

export function isCustomPeriod(periodId) {
  if (!periodId) return undefined;
  return Number(periodId) > 50;
}

export function getWeekStart() { // date in milliseconds
  const day = new Date(getToday());
  return day.setDate(day.getDate() - day.getDay());
}

export function getMonthLastDate(month, year) {
  return new Date(Number(year), Number(month) + 1, 0).getTime();
}
