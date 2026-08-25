"use client";

import { transcribeAudioRagApiAudioTranscribePost } from "@/features/rag/rag-api.generated";

import type { AudioTranscribeResponse } from "@/features/rag/rag-api.generated";

export async function transcribeAudio(audio: Blob): Promise<AudioTranscribeResponse> {
  const response = await transcribeAudioRagApiAudioTranscribePost({ audio });
  if (response.status !== 200) {
    throw new Error(`Failed to transcribe audio: ${response.status}`);
  }
  return response.data;
}
