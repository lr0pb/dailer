import { qs } from './highLevel/utils.js'
import { renderToggler } from './highLevel/taskThings.js'

export const wishlist = {
  get header() { return `${emjs.star} Your wishlist`},
  styleClasses: 'doubleColumns',
  get page() { return `
    <div class="doubleColumns" data-pri="2"></div>
    <div class="doubleColumns" data-pri="1"></div>
    <div class="doubleColumns" data-pri="0"></div>
    <h3 class="hidedUI">Completed wishes</h3>
    <div class="doubleColumns hidedUI" id="completed"></div>
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
      ...base, page: qs('.completed'), buttons: [{
        emoji: emjs.sign, title: text, aria: text, func: () => {}
      }]
    });
    renderToggler({
      ...base, page: qs(`[data-pri="${td.priority}"]`),
    });
  });
}
