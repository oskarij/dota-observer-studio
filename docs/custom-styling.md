# Custom styling

**Overlay → Custom CSS** (beside Components) restyles every element in both scenes. The CSS
is applied after the built-in styles, previewed live in the studio, and saved and exported
with the other overlay settings. Clearing it restores the default look.

Fonts and images go in the media folder (**Open media folder** under the editor). Refer to
them as `url(/media/<file>)`.

## How it combines with the pickers

The studio's pickers (position, size, font, colour, shadow) set these variables on every
element: `--el-x`, `--el-y`, `--el-scale`, `--el-color`, `--el-font-family`,
`--el-font-weight`, `--el-font-style` and `--el-shadow`. They are set inline, so to
override a picker from CSS mark the variable `!important`:

```css
.overlay-element {
  --el-font-family: 'League' !important;
}
```

The variables below are not set by any picker and need no `!important`. A font that
does not load falls back to Radiance, or to the system sans-serif when Dota 2 is not installed
on the PC that runs Observer Studio.

## Variables

| Variable                  | Default                     | Used for                                           |
| ------------------------- | --------------------------- | -------------------------------------------------- |
| `--db-accent`             | `#f8fbff`                   | Border and glow of the slot being picked or banned |
| `--db-active-image`       | `none`                      | Image drawn inside that slot, e.g. a league logo   |
| `--db-slot-background`    | `rgba(8, 10, 14, 0.55)`     | Every pick and ban slot                            |
| `--db-slot-border`        | `rgba(255, 255, 255, 0.12)` | Every pick and ban slot                            |
| `--db-figure-width`       | `1ch`                       | Width of one timer digit, so digits do not jitter  |
| `--db-figure-colon-width` | `0.45ch`                    | Width of the timer's colon                         |
| `--fd-ban-border`         | `rgba(220, 60, 50, 0.85)`   | Frame of each hero in the fearless ban pool        |
| `--fd-icon-width`         | `84px`                      | Width of each hero in the fearless ban pool        |

## Elements

Every element has the `overlay-element` class and `data-visible="true|false"`. In the IDs,
`<side>` is `radiant` or `dire` and `<scene>` is `draft` or `ingame`.

| Element         | Scene  | Root                                                          | Parts                                                 |
| --------------- | ------ | ------------------------------------------------------------- | ----------------------------------------------------- |
| Draft board     | draft  | `#draft-board.draft-board`                                    | see below                                             |
| Fearless bans   | draft  | `#fearless-draft.fearless-draft`                              | `__title`, `__grid`, `__hero`, `__icon`, `__fallback` |
| Player names    | draft  | `#player-names-<side>-draft.player-names[data-side="<side>"]` | `__name` (one per player)                             |
| Team name       | both   | `#team-name-<side>-<scene>.series-info--text`                 | `.series-info__content`                               |
| Team logo       | both   | `#team-logo-<side>-<scene>.series-info--logo`                 | `.series-info__content` (the image)                   |
| Series score    | both   | `#series-score-<side>-<scene>.series-info--text`              | `.series-info__content`                               |
| Selected player | ingame | `#selected-player.selected-player`                            | `__row`, `__name`, `__mmr`, `__medal`                 |

Parts are written after the element's class, e.g. `.fearless-draft__title`.

Draft board parts:

| Selector                                               | What it is                                    |
| ------------------------------------------------------ | --------------------------------------------- |
| `.draft-board[data-active-side="radiant\|dire\|none"]` | Whose turn it is                              |
| `.draft-board__slot--pick`, `.draft-board__slot--ban`  | One pick or ban slot                          |
| `.draft-board__slot[data-filled="true"]`               | Slot with a hero                              |
| `.draft-board__slot[data-active="true"]`               | The slot being picked or banned right now     |
| `.draft-board__portrait`                               | Hero video, poster or icon inside a slot      |
| `.draft-board__timer`, `.draft-board__arrow`           | Turn timer and the arrow pointing at its team |
| `.draft-board__reserve`                                | A team's reserve time                         |
| `.draft-board__side-label`                             | The RADIANT and DIRE labels                   |

## Recipes

League logo in the active slot, with a brand accent:

```css
.draft-board {
  --db-accent: #ffab53;
  --db-active-image: url(/media/league-mark.svg);
}
```

A custom font for every element:

```css
@font-face {
  font-family: 'League';
  src: url(/media/league.woff2) format('woff2');
}
.overlay-element {
  --el-font-family: 'League' !important;
}
```

Only the in-game scorebug's team names, without uppercase:

```css
#team-name-radiant-ingame .series-info__content,
#team-name-dire-ingame .series-info__content {
  text-transform: none;
}
```

A darker panel behind every slot, and no uppercase on the side labels:

```css
.draft-board {
  --db-slot-background: rgba(0, 0, 0, 0.8);
  --db-slot-border: transparent;
}
.draft-board__side-label {
  text-transform: none;
}
```

Remote `url()`s are blocked in the studio preview but load in OBS, so keep assets in the
media folder to see them in both.
