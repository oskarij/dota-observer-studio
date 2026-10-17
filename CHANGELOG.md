# Changelog

## 1.0.0

First public release.

- The overlay is two OBS Browser sources, one for the draft and one for the game, built on the
  **Overlay** page with a live preview.
- Elements: draft board, fearless bans, player names, team names, team logos, series score and the
  selected player with a rank medal.
- League tickets set the teams, sides and series score. A Steam Web API key adds the earlier games
  of a series. Lobbies without a ticket use the **Series** page.
- Custom CSS and a media folder for fonts and images ([docs/custom-styling.md](docs/custom-styling.md)).
- LAN access for OBS or Dota on another PC.
- GSI updates must carry this install's auth token. Install the GSI config again after updating.
- A log file: **Settings → Maintenance → Open logs folder**.
