export {
  database, IDB
} from '../logic/IDB.js'
export {
  getRawDate, isUnder3AM, oneDay, normalizeDate, getToday, intlDate, getTextDate,
  isCustomPeriod
} from '../pages/highLevel/periods.js'
export {
  setPeriodTitle
} from '../pages/highLevel/taskThings.js'

export const env = {
  db: null,
  periods: null,
  session: null,
};
