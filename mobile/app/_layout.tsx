import { OfflineStoreProvider } from "@/features/offline";
import { PlayerProvider } from "@/features/player/context";
import { VoiceCaptureProvider } from "@/features/player/voice-capture";
import { VoiceAgentProvider } from "@/features/voice-agent/context";
import { authClient } from "@/lib/auth-client";
import { createAppQueryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";

const queryClient = createAppQueryClient();

export default function RootLayout() {
  const { data: session } = authClient.useSession();
  const isAuthenticated = !!session;

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineStoreProvider>
        <PlayerProvider>
          <VoiceCaptureProvider>
            <VoiceAgentProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Protected guard={isAuthenticated}>
                  <Stack.Screen name="(app)" />
                </Stack.Protected>
                <Stack.Protected guard={!isAuthenticated}>
                  <Stack.Screen name="(auth)" />
                </Stack.Protected>
              </Stack>
            </VoiceAgentProvider>
          </VoiceCaptureProvider>
        </PlayerProvider>
      </OfflineStoreProvider>
    </QueryClientProvider>
  );
}
