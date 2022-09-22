const transform = 'translateY(3rem)';

export function togglableElement(elem, styleCode) {
  if (!elem || !styleCode) return;
  elem.classList.add('togglableElement');
  elem.setStyle = (styleCode) => {
    if (!['hided', 'showing'].includes(styleCode)) return;
    if (elem.children.length !== 2) return;
    elem.dataset.styleCode = styleCode;
    const value = styleCode == 'showing' ? 1 : 0;
    elem.children[0].style.transform = value ? 'none' : transform;
    elem.children[1].style.opacity = value;
  };
  elem.toggleStyle = () => {
    const newStyle = elem.dataset.styleCode == 'hided' ? 'showing' : 'hided';
    elem.setStyle(newStyle);
  };
  elem.setStyle(styleCode);
}
