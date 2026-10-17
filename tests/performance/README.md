# Overlay performance checks

Run `npm run test:performance` to build and exercise the real overlay, Svelte preview, video
assets, and HTTP/SSE server in a hidden Electron window. No running Studio or Dota instance is
required. The harness uses an ephemeral loopback port and its own `.dev/performance-electron`
profile, and exits with a nonzero status on failure. It writes `.dev/performance-after.json`
and `.dev/performance-draft.png`. Unit regressions also run with `npm test`.

## Measurements from the optimization pass

The baseline was the working tree at the start of the pass, including existing local changes.
Each rendering workload applies 600 cloned, unchanged snapshots after mounting the elements;
all components in the tested phase are enabled. CPU timings below are single-run measurements,
include snapshot cloning, and vary between runs. DOM mutation counts are the regression gate.
These are application measurements, not Dota FPS measurements.

| Workload                                       |  Before |                      After |
| ---------------------------------------------- | ------: | -------------------------: |
| In-game DOM mutations / 600 updates            |   6,600 |                          0 |
| Draft DOM mutations / 600 updates              |  22,200 |                          0 |
| Draft synchronous update time / 600 updates    | 95.9 ms | 19.9–30.4 ms across reruns |
| Running draft animations after clear           |       1 |                          0 |
| Team-store reads / 600 steady league updates   |   3,600 |                          1 |
| Rank-store reads / 600 selected-player updates |     600 |                          1 |

For a locally captured game snapshot (22,102 bytes when compacted), the projected overlay JSON is
703 bytes. Replaying 600 snapshots with only unused clock/provider values changing sent 600 SSE
messages before, and one 711-byte SSE message after. Real traffic still sends every change to
selection, names, phase, draft, or pause state; settings, series, profiles and ranks have their own
events. This replay reduction is not a prediction of bandwidth during an active draft.

The series/rank comparison uses instrumented stores: the read counts are exact, while timing does
not include a production SQLite workload. The Svelte preview is also tested with an effect flush
between each update, including profile edits, position edits, disable/enable, stale data,
minimize/restore, Sample/Live switching, and static portraits. The Sample preview must remain idle;
Live countdowns and hero changes must still render. Every bundled video has a decoded poster
check. OBS retains its video portraits and breathing animation. Cleared OBS draft videos must be
paused with their sources unloaded.

The final checks use a native EventSource connection to the production HTTP/SSE implementation
and built standalone overlay. They verify snapshot replay, profile/settings edits without a new
game packet, stale clearing, and recovery with an unchanged snapshot. The screenshot waits for
fonts, images and portrait video frames before capture.

## Verifying actual game FPS

Use the same replay segment, camera, graphics settings, OBS scene, and recording/streaming state
before and after. Compare Studio visible with its static preview and Studio minimized.
Keep OBS running in each comparison. Record average FPS and frame-time lows over the
same interval; an idle desktop renderer benchmark cannot establish recovery of the reported
30 FPS loss.

Reinstall Studio's generated GSI config and restart Dota to apply the new 200 ms throttle.
That changes the maximum send rate from 10 to 5 updates/second. Without reinstalling, the
rendering and server optimizations still apply, but Dota keeps using its old configuration.

The preview teardown follows Electron's [Page Visibility behavior](https://www.electronjs.org/docs/latest/api/browser-window#page-visibility).
The benchmark disables background throttling only in its isolated test window so a hidden test
can render; the production Studio retains Electron's default background throttling.
Only the screenshot uses a separate offscreen window so native-window occlusion cannot hide
image or video layers from the capture. The measured workloads run in a normal renderer.
