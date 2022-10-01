import { handleKeyboard } from '../utils/dom';

/**
 * Create segmented control component
 * @param {SegmentOptions} segmentOptions
 * 
 * @typedef {Object} SegmentOptions
 * @property {string} id
 * @property {Segment[]} segments
 * @property {number} [highlightIndex]
 * @property {SegmentClickCallback} [onClick] Callback to call on segment click
 * @property {object} [args]
 * @property {boolean} [activateOnClick] Call ActivateSegment function as soon as user click on the segment, default is true. If no onClick specified force true
 * 
 * @typedef {Object} Segment
 * @property {string} name
 * @property {'blue' | 'green' | 'red' | 'yellow'} [color] CSS custom variable color of the text, default is --mainText
 * 
 * @callback SegmentClickCallback
 * @param {SegmentClickOptions} options
 * 
 * @typedef {Object} SegmentClickOptions
 * @property {HTMLDivElement} elem
 * @property {number} index
 * @property {ActivateSegment} [activate] Passed only when SegmentOptions.activateOnClick == false
 * @property {any} [param] Any other params passed via args
 * 
 * @callback ActivateSegment Highlight clicked segment
 * @returns {void}
 */
export function renderSegmentedControl({
  id, segments, highlightIndex = 0, page, onClick, args = {}, activateOnClick = true
}) {
  const elem = document.createElement('div');
  elem.className = 'segments';
  if (id) elem.dataset.id = id;
  elem.dataset.value = highlightIndex;
  elem.setAttribute('focusgroup', 'horizontal');
  let text = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    text += addSegment(segment, i, highlightIndex == i);
  }
  elem.innerHTML = `
    <div class="abs segmentsRunner" style="--count: ${segments.length};"></div>
    <div class="abs segmentsContainer">${text}</div>
  `;
  const runner = elem.querySelector('.segmentsRunner');
  runner.style.setProperty('--index', highlightIndex);
  elem.addEventListener('click', async (e) => {
    const target = e.target.dataset.segment
    ? e.target : e.target.parentElement.dataset.segment
    ? e.target.parentElement
    : e.target.parentElement.parentElement.dataset.segment
    ? e.target.parentElement.parentElement : null;
    if (!target) return;
    const index = Number(target.dataset.segment);
    const activate = () => {
      elem.dataset.value = index;
      elem.querySelector('.highlighted').classList.remove('highlighted');
      target.classList.add('highlighted');
      runner.style.setProperty('--index', index);
      if (elem.onValueChanged) elem.onValueChanged();
    };
    if (activateOnClick || !onClick) activate();
    if (onClick) await onClick({
      elem, index, activate: activateOnClick ? null : activate, ...args
    });
  });
  elem.activateSegment = (index) => {
    if (
      index === undefined || index === null ||
      index < 0 || index >= segments.length
    ) return;
    if (!segments[index]) return;
    elem.querySelector(`[data-segment="${index}"]`).click();
  };
  elem.setValue = (value) => elem.activateSegment(value);
  handleKeyboard(elem);
  if (page) page.append(elem);
  return elem;
}

function addSegment(segment, index, isHighlight) {
  return `
    <div role="button" tabindex="${
      dailerData.focusgroup ? (isHighlight ? 0 : -1) : 0
    }" class="overlayHover ${
      isHighlight ? `highlighted` : ''
    }" data-segment="${index}"${
      segment.color ? ` style="color: var(--${segment.color});"` : ''
    }>
      <h3>${segment.name}</h3>
    </div>
  `;
}
