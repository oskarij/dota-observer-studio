import type { OverlayDefinition } from '../shared/overlay.js';

export const starterOverlays: OverlayDefinition[] = [
  {
    id: 'main',
    name: 'Main',
    route: '/overlay/main'
  },
  {
    id: 'chat',
    name: 'Chat',
    route: '/overlay/chat'
  },
  {
    id: 'alerts',
    name: 'Alerts',
    route: '/overlay/alerts'
  }
];

