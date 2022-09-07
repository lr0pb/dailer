import { qs, qsa } from '../utils/dom.js'
import { renderToggler } from './highLevel/taskThings.js'

export const wishlist = {
  get header() { return `${emjs.star} Your wishlist`},
  get page() { return `
    <div id="current" class="doubleColumns"></div>
    <h2 class="hidedUI">${emjs.party} Completed wishes</h2>
    <div id="completed" class="doubleColumns first hidedUI"></div>
  `},
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
  `},
  script: async ({globals, page}) => {
    qs('#back').addEventListener('click', () => history.back());
    await paintWishlist(globals, page);
  },
};

async function paintWishlist(globals, page) {
  await globals.db.getAll('tasks', (td) => {
    if (!td.wishlist) return;
    if (td.deleted) return;
    const base = { name: td.name, id: td.id };
    const text = 'Wish is completed';
    if (td.disabled) return renderToggler({
      ...base, page: qs('#completed'), buttons: [{
        emoji: emjs.sign, title: text, aria: text, func: () => {}
      }]
    });
    renderToggler({
      ...base, page: qs('#current'),
    });
  });
  if (qs('#completed').innerHTML == '') return;
  qsa('.hidedUI').forEach((item) => item.classList.remove('hidedUI'));
}
