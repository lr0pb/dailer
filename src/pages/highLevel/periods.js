export const getRawDate = (date) => {
  return new Date(date).setHours(0, 0, 0, 0);
};

export const isUnder3AM = (date) => {
  if (!date) date = new Date();
  return date.getTime() === getRawDate(date)
  ? false : date.getHours() < 3;
};

export const oneDay = 86400000; // 86 400 000 milliseconds in one day

export const normalizeDate = (date) => {
  if (typeof date == 'string') date = Number(date);
  date = new Date(date);
  const rawDate = getRawDate(date);
  return isUnder3AM(date) ? rawDate - oneDay : rawDate;
};

export const getToday = () => { // date in milliseconds
  return normalizeDate(Date.now());
};

export const convertDate = (date) => {
  return new Date(date).toLocaleDateString('en-ca');
};

export function isCustomPeriod(periodId) {
  if (!periodId) return undefined;
  return Number(periodId) > 50;
}

export function getWeekStart() { // date in milliseconds
  const day = new Date(getToday());
  return day.setDate(day.getDate() - day.getDay());
}
