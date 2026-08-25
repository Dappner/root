import { Directory, File } from "expo-file-system";
import { suggestionsApi } from "@/features/suggestions/api";
import { getPendingDirectory, getSourcesRootDirectory } from "./paths";
import type { PendingVoiceNote } from "./meta-types";

export interface EnqueueVoiceNoteInput {
  sourceId: number;
  episodeId?: number | null;
  playbackPositionSeconds?: number | null;
  recordedAt?: string | null;
  tempUri: string;
  audioExtension?: string;
}

function pendingJsonFile(sourceId: number, clientId: string): File {
  return new File(getPendingDirectory(sourceId), `${clientId}.json`);
}

function pendingAudioFile(sourceId: number, clientId: string, ext: string): File {
  return new File(getPendingDirectory(sourceId), `${clientId}.${ext}`);
}

function readPendingJson(file: File): PendingVoiceNote | null {
  try {
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as PendingVoiceNote;
  } catch {
    return null;
  }
}

function writePendingJson(file: File, note: PendingVoiceNote): void {
  file.create({ intermediates: true, overwrite: true });
  file.write(JSON.stringify(note, null, 2));
}

export async function enqueueVoiceNote(input: EnqueueVoiceNoteInput): Promise<string> {
  const clientId = `voice-${input.sourceId}-${Date.now()}`;
  const ext = input.audioExtension ?? "m4a";

  const dir = getPendingDirectory(input.sourceId);
  dir.create({ intermediates: true, idempotent: true });

  const destAudio = pendingAudioFile(input.sourceId, clientId, ext);
  const tempFile = new File(input.tempUri);
  try {
    tempFile.move(destAudio);
  } catch {
    // Fallback: copy if move across volumes fails (shouldn't on iOS sandbox).
    tempFile.copy(destAudio);
    if (tempFile.exists) tempFile.delete();
  }

  const note: PendingVoiceNote = {
    client_id: clientId,
    source_id: input.sourceId,
    episode_id: input.episodeId ?? undefined,
    playback_position_seconds: input.playbackPositionSeconds ?? undefined,
    recorded_at: input.recordedAt ?? new Date().toISOString(),
    attempts: 0,
    status: "pending",
    audio_file: `${clientId}.${ext}`,
  };
  writePendingJson(pendingJsonFile(input.sourceId, clientId), note);
  return clientId;
}

export function listPendingForSource(sourceId: number): PendingVoiceNote[] {
  const dir = getPendingDirectory(sourceId);
  if (!dir.exists) return [];

  const results: PendingVoiceNote[] = [];
  for (const entry of dir.list()) {
    if (!entry.name.endsWith(".json")) continue;
    const note = readPendingJson(entry instanceof File ? entry : new File(dir, entry.name));
    if (note) results.push(note);
  }
  results.sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  return results;
}

export function listAllPending(): PendingVoiceNote[] {
  const root = getSourcesRootDirectory();
  if (!root.exists) return [];

  const results: PendingVoiceNote[] = [];
  for (const entry of root.list()) {
    const sourceId = Number(entry.name);
    if (!Number.isFinite(sourceId)) continue;
    results.push(...listPendingForSource(sourceId));
  }
  return results;
}

export function discardPendingNote(sourceId: number, clientId: string): void {
  const dir = getPendingDirectory(sourceId);
  if (!dir.exists) return;
  for (const entry of dir.list()) {
    if (entry.name.startsWith(clientId)) {
      try {
        (entry instanceof File ? entry : new File(dir, entry.name)).delete();
      } catch {}
    }
  }
}

export function retryPendingNote(sourceId: number, clientId: string): void {
  const file = pendingJsonFile(sourceId, clientId);
  const note = readPendingJson(file);
  if (!note) return;
  writePendingJson(file, { ...note, status: "pending", last_error: undefined });
}

let processing = false;

export async function processOutbox(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const notes = listAllPending().filter((n) => n.status === "pending");
    for (const note of notes) {
      await uploadOne(note);
    }
  } finally {
    processing = false;
  }
}

async function uploadOne(note: PendingVoiceNote): Promise<void> {
  const dir = getPendingDirectory(note.source_id);
  const audio = new File(dir, note.audio_file);
  const jsonF = pendingJsonFile(note.source_id, note.client_id);

  if (!audio.exists) {
    // Stale entry, drop it.
    if (jsonF.exists) jsonF.delete();
    return;
  }

  try {
    await suggestionsApi.createVoice({
      uri: audio.uri,
      clientId: note.client_id,
      sourceId: note.source_id,
      episodeId: note.episode_id ?? null,
      playbackPositionSeconds: note.playback_position_seconds ?? null,
      recordedAt: note.recorded_at,
    });
    audio.delete();
    if (jsonF.exists) jsonF.delete();
    cleanupEmptyPendingDir(note.source_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isPermanent = /\b(4\d\d)\b/.test(message) && !/\b(408|429)\b/.test(message);
    writePendingJson(jsonF, {
      ...note,
      attempts: note.attempts + 1,
      last_error: message,
      status: isPermanent ? "failed" : "pending",
    });
  }
}

function cleanupEmptyPendingDir(sourceId: number): void {
  const dir = getPendingDirectory(sourceId);
  if (!dir.exists) return;
  try {
    const entries = dir.list();
    if (entries.length === 0) dir.delete();
  } catch {}
}
