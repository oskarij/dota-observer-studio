import assert from 'node:assert/strict';
import test from 'node:test';

import {
  anchoredRegionLeft,
  createDefaultComponentSettings,
  positionForAnchor,
  type ComponentAnchor,
  type ElementBox
} from '../src/shared/componentSettings.js';

const BOX: ElementBox = { x: 203, y: 470, width: 400, height: 40 };

// The inverse of what applyElementSettings writes into CSS: `position` is where the anchored point
// lands, and the translate slides the box off its top-left corner to put it there.
function stageBox(position: { x: number; y: number }, anchor: ComponentAnchor): ElementBox {
  const shiftX = { left: 0, center: BOX.width / 2, right: BOX.width }[anchor.x];
  const shiftY = { top: 0, center: BOX.height / 2, bottom: BOX.height }[anchor.y];

  return { ...BOX, x: position.x - shiftX, y: position.y - shiftY };
}

test('position names the anchored point on the element box', () => {
  assert.deepEqual(positionForAnchor(BOX, { x: 'left', y: 'top' }), { x: 203, y: 470 });
  // Right/bottom are the far edges: 203 + 400, 470 + 40.
  assert.deepEqual(positionForAnchor(BOX, { x: 'right', y: 'bottom' }), { x: 603, y: 510 });
  assert.deepEqual(positionForAnchor(BOX, { x: 'center', y: 'center' }), { x: 403, y: 490 });
});

test('switching anchor leaves the element where it is', () => {
  const anchors: ComponentAnchor[] = (['top', 'center', 'bottom'] as const).flatMap((y) =>
    (['left', 'center', 'right'] as const).map((x) => ({ x, y }))
  );

  for (const anchor of anchors) {
    const box = stageBox(positionForAnchor(BOX, anchor), anchor);
    assert.deepEqual(
      { x: box.x, y: box.y },
      { x: BOX.x, y: BOX.y },
      `anchor ${anchor.y}-${anchor.x} moved the box`
    );
  }
});

test('default settings never share nested objects between components', () => {
  const first = createDefaultComponentSettings('draft-board');
  const second = createDefaultComponentSettings('draft-board');

  first.position.x = 999;
  first.anchor.x = 'right';

  assert.equal(second.position.x, 960);
  assert.equal(second.anchor.x, 'center');
});

test('a width cap sits opposite its anchor, so the slack falls where the text does not grow', () => {
  // Left-anchored: the name starts at x and runs right, so the cap region does too.
  assert.equal(anchoredRegionLeft('left', 80, 620), 80);

  // Right-anchored (the Dire name, pinned to the stage's right edge): it grows leftwards, so the
  // region ends at x and the slack is on the left.
  assert.equal(anchoredRegionLeft('right', 1840, 620), 1220);

  // Centred: split either side, so the midpoint stays the midpoint.
  assert.equal(anchoredRegionLeft('center', 960, 620), 650);
});

test('the cap region always contains the anchor point it is measured from', () => {
  for (const anchor of ['left', 'center', 'right'] as const) {
    const left = anchoredRegionLeft(anchor, 960, 400);
    assert.ok(left <= 960 && 960 <= left + 400, `${anchor} region excluded its own anchor`);
  }
});
