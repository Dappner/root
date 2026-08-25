import {
  deleteCollection,
  removeSourceFromCollection,
  listCollections,
  getCollection,
  listCollectionSources,
  createCollection,
  addSourceToCollection,
  updateCollection,
} from "@/features/rag/rag-api.generated";

import type {
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from "./types";

export const collectionsApi = {
  getCollections: async () => {
    const response = await listCollections();
    if (response.status !== 200) {
      throw new Error(`Failed to get collections: ${response.status}`);
    }
    return response.data;
  },

  getCollection: async (id: number) => {
    const response = await getCollection(id);
    if (response.status !== 200) {
      throw new Error(`Failed to get collection: ${response.status}`);
    }
    return response.data;
  },

  createCollection: async (data: CreateCollectionRequest) => {
    const response = await createCollection(data);
    if (response.status !== 201) {
      throw new Error(`Failed to create collection: ${response.status}`);
    }
    return response.data;
  },

  updateCollection: async (id: number, data: UpdateCollectionRequest) => {
    const response = await updateCollection(id, data);
    if (response.status !== 200) {
      throw new Error(`Failed to update collection: ${response.status}`);
    }
    return response.data;
  },

  deleteCollection: async (id: number): Promise<void> => {
    const response = await deleteCollection(id);
    if (response.status !== 204) {
      throw new Error(`Failed to delete collection: ${response.status}`);
    }
  },

  getCollectionSourceIDs: async (id: number) => {
    const response = await listCollectionSources(id);
    if (response.status !== 200) {
      throw new Error(`Failed to get collection sources: ${response.status}`);
    }
    return response.data;
  },

  addSourceToCollection: async (collectionId: number, sourceId: number): Promise<void> => {
    const response = await addSourceToCollection(collectionId, { source_id: sourceId });
    if (response.status !== 204) {
      throw new Error(`Failed to add source to collection: ${response.status}`);
    }
  },

  removeSourceFromCollection: async (collectionId: number, sourceId: number): Promise<void> => {
    const response = await removeSourceFromCollection(collectionId, sourceId);
    if (response.status !== 204) {
      throw new Error(`Failed to remove source from collection: ${response.status}`);
    }
  },
};
