import { anchorShift, type ComponentSettings } from '../shared/componentSettings.js';
import { setStyle } from './dom.js';
import './elements.css';

// Writes the --el-* properties that elements.css reads.
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
