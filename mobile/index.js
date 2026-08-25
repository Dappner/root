if (typeof globalThis.DOMException === "undefined") {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message = "", name = "Error") {
      super(message);
      this.name = name;
    }
  };
}

const TrackPlayer = require("react-native-track-player").default;
const { PlaybackService } = require("./features/player/playback-service");
TrackPlayer.registerPlaybackService(() => PlaybackService);

require("expo-router/entry");
