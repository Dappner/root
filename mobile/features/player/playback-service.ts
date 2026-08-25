import TrackPlayer, { Event } from "react-native-track-player";

const SKIP_BACK_SEC = 15;
const SKIP_FORWARD_SEC = 30;

/**
 * Track-player background service. Registered in index.js before the router
 * entry. Handles remote events from the lock screen / Control Center / car /
 * Bluetooth so transport controls work while the app is backgrounded.
 *
 * Keep this thin: it drives TrackPlayer directly. The React player context
 * (features/player/context.tsx) subscribes to the resulting state changes and
 * owns app-level concerns (progress saving, status transitions).
 */
export async function PlaybackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) =>
    TrackPlayer.seekTo(position),
  );
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) =>
    TrackPlayer.seekBy(-(interval ?? SKIP_BACK_SEC)),
  );
  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) =>
    TrackPlayer.seekBy(interval ?? SKIP_FORWARD_SEC),
  );
}
