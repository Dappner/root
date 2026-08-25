import { useEffect, useRef } from "react";
import { useNetworkState } from "expo-network";

export function useIsOnline(): boolean {
  const state = useNetworkState();
  // expo-network exposes `isInternetReachable` (may be undefined while probing)
  // and `isConnected`. Treat "unknown" as online to avoid false offline pills.
  if (state.isInternetReachable === false) return false;
  if (state.isConnected === false) return false;
  return true;
}

export function useOnReconnect(callback: () => void) {
  const online = useIsOnline();
  const prevRef = useRef(online);
  useEffect(() => {
    if (!prevRef.current && online) callback();
    prevRef.current = online;
  }, [online, callback]);
}
