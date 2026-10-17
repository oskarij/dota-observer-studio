# Observer Studio

Observer Studio builds Dota 2 spectator-stream overlays. It reads live match data from Dota's Game
State Integration (GSI), lets you design an overlay with a live preview, and serves it to OBS as two
Browser sources: one for the draft, one for the game.

## Requirements

Windows 10/11, Dota 2, and OBS (or anything that supports a Browser source).

## Quick start

1. Download the latest `Observer Studio-<version>-win-x64.zip` from Releases, extract it, and run
   `Observer Studio.exe`. It's unsigned, so on the SmartScreen prompt click **More info → Run anyway**.
2. **Settings → Game integration → Install GSI config**, then add the `-gamestateintegration` launch
   option to Dota (Steam → Dota 2 → Properties → Launch Options) and restart Dota.
3. **Settings → OBS browser sources**: add each URL as a Browser source in the matching OBS scene,
   at your canvas size. Build both scenes on the **Overlay** page; its Draft / In-game tabs switch
   between them.

GSI only sends data while you're spectating or in a match, so the status stays "Not connected" until
then.

**Updating from an older version:** run **Settings → Game integration → Install GSI config** again
and restart Dota. The draft board needs the draft data, which older configs turn off.

## Teams, scores and fearless picks

In a league lobby, the ticket names both teams, their sides and the series score, and a new matchup
replaces the previous one automatically. Each team is saved under its Valve team ID the first time
it appears, so you can rename it or add a logo on **Teams & Players**; to use a team you created
yourself, enter its Valve team ID there. Without a ticket, pick the teams and keep the score on the
**Series** page; players linked to teams on **Teams & Players** put each team on its side.

**Optional: Steam Web API key.** To load the earlier games of a league series you did not spectate
(for fearless picks and scores), save your own key in **Settings → Steam Web API key**. Get one at
[steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey). It is stored encrypted on
your PC.

## Custom styling

The **Custom CSS** box on the **Overlay** page restyles the overlay for both scenes, with a live
preview. Put fonts and images in the media folder (**Open media folder**) and use them as
`url(/media/<file>)`. The styling hooks and recipes are in
[docs/custom-styling.md](docs/custom-styling.md).

## Performance

The Studio preview shows still hero portraits; OBS shows the animated ones. Minimizing Studio
pauses the preview, and restoring it shows the latest state.

## OBS or Dota on another PC

Turn on **Settings → Network access → Allow LAN access** and restart. Settings then shows the URLs
with your LAN address: use the overlay URLs in OBS on the other PC, or **Export config for another
PC** to get a GSI config for a separate Dota machine. This exposes the GSI listener to your network,
so use it only on networks you trust.

## Build from source

```sh
npm install
npm run dev       # run in development
npm test          # unit tests
npm run package   # build a Windows zip into release/
```

## License

[MIT](LICENSE). UI primitives under `src/lib/components/ui` are vendored from
[shadcn-svelte](https://www.shadcn-svelte.com/) under their own license.
