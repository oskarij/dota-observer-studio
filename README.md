# Observer Studio

Observer Studio builds Dota 2 spectator-stream overlays. It reads live match data from Dota's Game
State Integration (GSI), lets you design an overlay with a live preview, and serves it to OBS as a
Browser source.

## Requirements

Windows 10/11, Dota 2, and OBS (or anything that supports a Browser source).

## Quick start

1. Download the latest `Observer Studio-<version>-win-x64.zip` from Releases, extract it, and run
   `Observer Studio.exe`. It's unsigned, so on the SmartScreen prompt click **More info → Run anyway**.
2. **Settings → Game integration → Install GSI config**, then add the `-gamestateintegration` launch
   option to Dota (Steam → Dota 2 → Properties → Launch Options) and restart Dota.
3. **Settings → OBS browser source**: copy the URL into an OBS Browser source (transparent
   background, your canvas size). Build the overlay on the **Overlay** page.

GSI only sends data while you're spectating or in a match, so the status stays "Not connected" until
then.

## OBS or Dota on another PC

Turn on **Settings → Network access → Allow LAN access** and restart. Settings then shows the URLs
with your LAN address: use the overlay URL in OBS on the other PC, or **Export config for another
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
