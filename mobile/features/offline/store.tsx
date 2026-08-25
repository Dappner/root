import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TranscriptData } from "@/lib/api/rag-generated";
import {
  deleteSourceDownload,
  downloadSource as fsDownloadSource,
  getDownloadedSourcesStorageBytes as fsGetDownloadedSourcesStorageBytes,
  listDownloadedSources as fsListDownloadedSources,
  readLocalTranscript as fsReadLocalTranscript,
  readSourceMeta as fsReadSourceMeta,
  resolveLocalAudioUri as fsResolveLocalAudioUri,
  writeLocalTranscript as fsWriteLocalTranscript,
  type DownloadSourceInput,
} from "./backends/fs/sources";
import {
  listDownloadedPodcastMetas as fsListDownloadedPodcastMetas,
  writePodcastMeta as fsWritePodcastMeta,
} from "./backends/fs/podcasts";
import {
  discardPendingNote as fsDiscardPendingNote,
  enqueueVoiceNote as fsEnqueueVoiceNote,
  listAllPending as fsListAllPending,
  listPendingForSource as fsListPendingForSource,
  processOutbox as fsProcessOutbox,
  retryPendingNote as fsRetryPendingNote,
  type EnqueueVoiceNoteInput,
} from "./backends/fs/outbox";
import type { PendingVoiceNote, PodcastMeta, SourceMeta } from "./backends/fs/meta-types";

export type { PendingVoiceNote, PodcastMeta, SourceMeta, DownloadSourceInput, EnqueueVoiceNoteInput };

interface OfflineStore {
  version: number;

  isSourceDownloaded(sourceId: number): boolean;
  getSourceMeta(sourceId: number): SourceMeta | null;
  listDownloadedSources(): SourceMeta[];
  getDownloadedStorageBytes(): number;
  downloadSource(input: DownloadSourceInput): Promise<void>;
  deleteSource(sourceId: number): Promise<void>;

  getPodcastMeta(podcastId: number): PodcastMeta | null;
  savePodcastMeta(meta: PodcastMeta): void;
  listDownloadedPodcastMetas(): PodcastMeta[];

  resolveLocalAudio(sourceId: number): string | null;
  resolveLocalTranscript(sourceId: number): TranscriptData | null;
  saveLocalTranscript(sourceId: number, transcript: TranscriptData): void;

  enqueueVoiceNote(input: EnqueueVoiceNoteInput): Promise<string>;
  listPendingForSource(sourceId: number): PendingVoiceNote[];
  listAllPending(): PendingVoiceNote[];
  processOutbox(): Promise<void>;
  discardPendingNote(sourceId: number, clientId: string): void;
  retryPendingNote(sourceId: number, clientId: string): void;
}

interface Caches {
  sources: Map<number, SourceMeta>;
  podcasts: Map<number, PodcastMeta>;
  pendingBySource: Map<number, PendingVoiceNote[]>;
  audioUriBySource: Map<number, string | null>;
  transcriptBySource: Map<number, TranscriptData | null>;
}

const OfflineStoreContext = createContext<OfflineStore | null>(null);

const EMPTY_PENDING: PendingVoiceNote[] = [];

export function OfflineStoreProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const cachesRef = useRef<Caches>({
    sources: new Map(),
    podcasts: new Map(),
    pendingBySource: new Map(),
    audioUriBySource: new Map(),
    transcriptBySource: new Map(),
  });

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const hydrateSource = useCallback((sourceId: number) => {
    const caches = cachesRef.current;
    const meta = fsReadSourceMeta(sourceId);
    if (meta) {
      caches.sources.set(sourceId, meta);
    } else {
      caches.sources.delete(sourceId);
    }
    caches.audioUriBySource.delete(sourceId);
    caches.transcriptBySource.delete(sourceId);
    caches.pendingBySource.set(sourceId, fsListPendingForSource(sourceId));
  }, []);

  useEffect(() => {
    const caches = cachesRef.current;
    let cancelled = false;

    const hydrate = () => {
      const sources = fsListDownloadedSources();
      const podcasts = fsListDownloadedPodcastMetas();
      const pending = fsListAllPending();

      if (cancelled) return;

      caches.sources.clear();
      for (const m of sources) caches.sources.set(m.source.id, m);

      caches.podcasts.clear();
      for (const m of podcasts) caches.podcasts.set(m.podcast_id, m);

      caches.pendingBySource.clear();
      for (const note of pending) {
        const list = caches.pendingBySource.get(note.source_id) ?? [];
        list.push(note);
        caches.pendingBySource.set(note.source_id, list);
      }

      caches.audioUriBySource.clear();
      caches.transcriptBySource.clear();

      bump();
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [bump]);

  const isSourceDownloaded = useCallback((sourceId: number) => {
    return cachesRef.current.sources.has(sourceId);
  }, []);

  const getSourceMeta = useCallback((sourceId: number) => {
    return cachesRef.current.sources.get(sourceId) ?? null;
  }, []);

  const listDownloadedSourcesCached = useCallback(() => {
    const list = Array.from(cachesRef.current.sources.values());
    list.sort(
      (a, b) =>
        new Date(b.downloaded_at).getTime() - new Date(a.downloaded_at).getTime()
    );
    return list;
  }, []);

  const getDownloadedStorageBytes = useCallback(() => {
    return fsGetDownloadedSourcesStorageBytes();
  }, []);

  const getPodcastMeta = useCallback((podcastId: number) => {
    return cachesRef.current.podcasts.get(podcastId) ?? null;
  }, []);

  const listDownloadedPodcastMetasCached = useCallback(() => {
    return Array.from(cachesRef.current.podcasts.values());
  }, []);

  const listPendingForSourceCached = useCallback((sourceId: number) => {
    return cachesRef.current.pendingBySource.get(sourceId) ?? EMPTY_PENDING;
  }, []);

  const listAllPendingCached = useCallback(() => {
    const out: PendingVoiceNote[] = [];
    for (const list of cachesRef.current.pendingBySource.values()) {
      out.push(...list);
    }
    return out;
  }, []);

  const resolveLocalAudio = useCallback((sourceId: number) => {
    const caches = cachesRef.current;
    if (caches.audioUriBySource.has(sourceId)) {
      return caches.audioUriBySource.get(sourceId) ?? null;
    }
    const uri = fsResolveLocalAudioUri(sourceId);
    caches.audioUriBySource.set(sourceId, uri);
    return uri;
  }, []);

  const resolveLocalTranscript = useCallback((sourceId: number) => {
    const caches = cachesRef.current;
    if (caches.transcriptBySource.has(sourceId)) {
      return caches.transcriptBySource.get(sourceId) ?? null;
    }
    const transcript = fsReadLocalTranscript(sourceId);
    caches.transcriptBySource.set(sourceId, transcript);
    return transcript;
  }, []);

  const downloadSource = useCallback(
    async (input: DownloadSourceInput) => {
      await fsDownloadSource(input);
      hydrateSource(input.source.id);
      bump();
    },
    [bump, hydrateSource]
  );

  const deleteSource = useCallback(
    async (sourceId: number) => {
      deleteSourceDownload(sourceId);
      const caches = cachesRef.current;
      caches.sources.delete(sourceId);
      caches.audioUriBySource.delete(sourceId);
      caches.transcriptBySource.delete(sourceId);
      caches.pendingBySource.delete(sourceId);
      bump();
    },
    [bump]
  );

  const savePodcastMeta = useCallback(
    (meta: PodcastMeta) => {
      fsWritePodcastMeta(meta);
      cachesRef.current.podcasts.set(meta.podcast_id, meta);
      bump();
    },
    [bump]
  );

  const saveLocalTranscript = useCallback(
    (sourceId: number, transcript: TranscriptData) => {
      fsWriteLocalTranscript(sourceId, transcript);
      cachesRef.current.transcriptBySource.set(sourceId, transcript);
      bump();
    },
    [bump]
  );

  const enqueueVoiceNote = useCallback(
    async (input: EnqueueVoiceNoteInput) => {
      const clientId = await fsEnqueueVoiceNote(input);
      cachesRef.current.pendingBySource.set(
        input.sourceId,
        fsListPendingForSource(input.sourceId)
      );
      bump();
      return clientId;
    },
    [bump]
  );

  const processOutbox = useCallback(async () => {
    await fsProcessOutbox();
    const caches = cachesRef.current;
    caches.pendingBySource.clear();
    for (const note of fsListAllPending()) {
      const list = caches.pendingBySource.get(note.source_id) ?? [];
      list.push(note);
      caches.pendingBySource.set(note.source_id, list);
    }
    bump();
  }, [bump]);

  const discardPendingNote = useCallback(
    (sourceId: number, clientId: string) => {
      fsDiscardPendingNote(sourceId, clientId);
      cachesRef.current.pendingBySource.set(
        sourceId,
        fsListPendingForSource(sourceId)
      );
      bump();
    },
    [bump]
  );

  const retryPendingNote = useCallback(
    (sourceId: number, clientId: string) => {
      fsRetryPendingNote(sourceId, clientId);
      cachesRef.current.pendingBySource.set(
        sourceId,
        fsListPendingForSource(sourceId)
      );
      bump();
      void processOutbox();
    },
    [bump, processOutbox]
  );

  const value = useMemo<OfflineStore>(
    () => ({
      version,
      isSourceDownloaded,
      getSourceMeta,
      listDownloadedSources: listDownloadedSourcesCached,
      getDownloadedStorageBytes,
      downloadSource,
      deleteSource,
      getPodcastMeta,
      savePodcastMeta,
      listDownloadedPodcastMetas: listDownloadedPodcastMetasCached,
      resolveLocalAudio,
      resolveLocalTranscript,
      saveLocalTranscript,
      enqueueVoiceNote,
      listPendingForSource: listPendingForSourceCached,
      listAllPending: listAllPendingCached,
      processOutbox,
      discardPendingNote,
      retryPendingNote,
    }),
    [
      version,
      isSourceDownloaded,
      getSourceMeta,
      listDownloadedSourcesCached,
      getDownloadedStorageBytes,
      downloadSource,
      deleteSource,
      getPodcastMeta,
      savePodcastMeta,
      listDownloadedPodcastMetasCached,
      resolveLocalAudio,
      resolveLocalTranscript,
      saveLocalTranscript,
      enqueueVoiceNote,
      listPendingForSourceCached,
      listAllPendingCached,
      processOutbox,
      discardPendingNote,
      retryPendingNote,
    ]
  );

  return <OfflineStoreContext.Provider value={value}>{children}</OfflineStoreContext.Provider>;
}

export function useOfflineStore(): OfflineStore {
  const ctx = useContext(OfflineStoreContext);
  if (!ctx) throw new Error("useOfflineStore must be used within OfflineStoreProvider");
  return ctx;
}
