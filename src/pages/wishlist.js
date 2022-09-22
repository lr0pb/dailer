import { qs, qsa } from '../utils/dom.js'
import { renderTask } from './highLevel/taskThings.js'

export const wishlist = {
  get header() { return `${emjs.star} Your wishlist`},
  get page() { return `
    <div id="current" class="doubleColumns"></div>
    <h2 class="hidedUI">${emjs.party} Completed wishes</h2>
    <div id="completed" class="doubleColumns first hidedUI"></div>
  `},
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="addWish">${emjs.star} Add new wish</button>
  `},
  script: async ({globals, page}) => {
    qs('#back').addEventListener('click', () => history.back());
    qs('#addWish').addEventListener('click', async () => {
      await globals.paintPage('taskCreator', {
        params: { wishlist: 'true' }
      });
    });
    await paintWishlist(globals, page);
  },
};

async function paintWishlist(globals, page) {
  const current = qs('#current');
  const completed = qs('#completed');
  await globals.db.getAll('tasks', (td) => {
    if (!td.wishlist) return;
    if (td.deleted) return;
    const text = 'Wish is completed';
    const buttons = [{
      emoji: emjs.sign, title: text, aria: text, func: () => {}
    }];
    renderTask(globals, td, td.disabled ? completed : current, {
      openTask: true, completeTask: !td.disabled,
      customButtons: td.disabled ? buttons : null
    });
  });
  const hasActive = qs('#current').innerHTML !== '';
  const hasCompleted = qs('#completed').innerHTML !== '';
  if (!hasActive && !hasCompleted) {
    page.classList.add('center', 'doubleColumns');
    page.innerHTML = `
      <h2 class="emoji">${emjs.empty}</h2>
      <h2>You have no wishes stored here yet!</h2>
    `;
    return;
  }
  if (!hasActive) {
    //
  }
  if (hasCompleted) {
    qsa('.hidedUI').forEach((item) => item.classList.remove('hidedUI'));
  }
}
