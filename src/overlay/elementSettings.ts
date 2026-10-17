import { anchorShift, type ComponentSettings } from '../shared/componentSettings.js';
import { setStyle } from './dom.js';
import './elements.css';

// The one place a ComponentSettings becomes CSS, shared by every movable element. The values land
// as --el-* custom properties on the element's root, which carries the `overlay-element` class
// that reads them (elements.css).
//
// `position` is a plain stage coordinate; `anchor` names the point on the element's own box that
// lands there — its left edge, its centre, its bottom-right corner. The translate slides the box off
// its top-left corner by that much, and the transform-origin makes the size slider scale it about
// the same point, so the anchored point is what holds still as the content or the scale changes.
export function applyElementSettings(root: HTMLElement, settings: ComponentSettings): void {
  const anchor = settings.anchor ?? { x: 'left', y: 'top' };
  const { shadow } = settings;

  setStyle(root, '--el-x', `${settings.position.x}px`);
  setStyle(root, '--el-y', `${settings.position.y}px`);
  setStyle(root, '--el-scale', String(settings.size / 100));
  setStyle(root, '--el-anchor-x', anchor.x);
  setStyle(root, '--el-anchor-y', anchor.y);
  setStyle(root, '--el-shift-x', anchorShift(anchor.x));
  setStyle(root, '--el-shift-y', anchorShift(anchor.y));
  setStyle(root, '--el-color', settings.color);
  // Quoted: an unquoted family such as "Press Start 2P" is invalid CSS and drops the declaration.
  setStyle(root, '--el-font-family', JSON.stringify(settings.font.family));
  setStyle(root, '--el-font-weight', String(settings.font.weight));
  setStyle(root, '--el-font-style', settings.font.italic ? 'italic' : 'normal');
  setStyle(
    root,
    '--el-shadow',
    `0 0 ${shadow.blur}px ${shadow.color}, ${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`
  );
}
