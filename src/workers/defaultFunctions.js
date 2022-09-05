export {
  database, IDB
} from '../logic/IDB.js'
export {
  getRawDate, isUnder3AM, oneDay, normalizeDate, getToday, isCustomPeriod
} from '../pages/highLevel/periods.js'
export {
  intlDate
} from '../pages/highLevel/utils.js'
export {
  getTextDate, setPeriodTitle
} from '../pages/highLevel/taskThings.js'

export const env = {
  db: null,
  periods: null,
  session: null,
};
