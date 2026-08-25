import {
  createTag,
  deleteTag,
  getTag,
  listTags,
  updateTag,
} from "@/features/rag/rag-api.generated";

import type { CreateTagRequest, TagDTO, UpdateTagRequest } from "./types";

export const tagsApi = {
  getTags: async (): Promise<TagDTO[]> => {
    const response = await listTags();
    if (response.status !== 200) {
      throw new Error(`Failed to get tags: ${response.status}`);
    }
    return response.data as TagDTO[];
  },

  getTag: async (id: number): Promise<TagDTO> => {
    const response = await getTag(id);
    if (response.status !== 200) {
      throw new Error(`Failed to get tag: ${response.status}`);
    }
    return response.data as TagDTO;
  },

  createTag: async (data: CreateTagRequest): Promise<TagDTO> => {
    const response = await createTag(data);
    if (response.status !== 201) {
      throw new Error(`Failed to create tag: ${response.status}`);
    }
    return response.data as TagDTO;
  },

  updateTag: async (id: number, data: UpdateTagRequest): Promise<TagDTO> => {
    const response = await updateTag(id, data);
    if (response.status !== 200) {
      throw new Error(`Failed to update tag: ${response.status}`);
    }
    return response.data as TagDTO;
  },

  deleteTag: async (id: number): Promise<void> => {
    const response = await deleteTag(id);
    if (response.status !== 204) {
      throw new Error(`Failed to delete tag: ${response.status}`);
    }
  },
};
