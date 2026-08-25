import {
  addVideoToLibrary as apiAddToLibrary,
  importVideo as apiImportVideo,
  getVideo as apiGetVideo,
} from "@/features/rag/rag-api.generated";
import {
  generateVideoTranscriptRagApiTranscriptVideoGeneratePost,
  getVideoTranscriptContentRagApiTranscriptVideoVideoIdContentGet,
  getVideoTranscriptStatusRagApiTranscriptVideoVideoIdGet,
} from "@/features/rag/rag-api.generated";

import type { SourceDTO } from "../sources/types";
import type {
  AddVideoToLibraryRequest,
  GenerateTranscriptResponse,
  GenerateVideoTranscriptRequest,
  ImportVideoRequest,
  TranscriptData,
  VideoDTO,
} from "./types";

// ============================================================================
// Video API
// ============================================================================

export async function importVideo(data: ImportVideoRequest): Promise<VideoDTO> {
  const response = await apiImportVideo(data);
  if (response.status !== 200) {
    throw new Error(`Failed to import video: ${response.status}`);
  }
  return response.data;
}

export async function addVideoToLibrary(
  data: AddVideoToLibraryRequest,
): Promise<SourceDTO> {
  const response = await apiAddToLibrary(data);
  if (response.status !== 200) {
    throw new Error(`Failed to add video to library: ${response.status}`);
  }
  // The sources facade only loosens metadata and relabels the generated DTO for
  // feature-local use.
  return response.data as unknown as SourceDTO;
}

export async function getVideo(videoId: number): Promise<VideoDTO> {
  const response = await apiGetVideo(videoId);
  if (response.status !== 200) {
    throw new Error(`Failed to get video: ${response.status}`);
  }
  return response.data;
}

// ============================================================================
// Video Transcript API (calls RAG service)
// ============================================================================

export async function generateVideoTranscript(
  videoId: number,
): Promise<GenerateTranscriptResponse> {
  const response =
    await generateVideoTranscriptRagApiTranscriptVideoGeneratePost({
      video_id: videoId,
    } satisfies GenerateVideoTranscriptRequest);
  if (response.status !== 200) {
    throw new Error(`Failed to generate video transcript: ${response.status}`);
  }
  return response.data;
}

export async function getVideoTranscriptStatus(
  videoId: number,
): Promise<GenerateTranscriptResponse> {
  const response =
    await getVideoTranscriptStatusRagApiTranscriptVideoVideoIdGet(videoId);
  if (response.status !== 200) {
    throw new Error(
      `Failed to get video transcript status: ${response.status}`,
    );
  }
  return response.data;
}

export async function getVideoTranscriptContent(
  videoId: number,
): Promise<TranscriptData> {
  const response =
    await getVideoTranscriptContentRagApiTranscriptVideoVideoIdContentGet(
      videoId,
    );
  if (response.status !== 200) {
    throw new Error(
      `Failed to get video transcript content: ${response.status}`,
    );
  }
  return response.data;
}
