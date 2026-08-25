import type {
  CreateTakeawayRequest as ApiCreateTakeawayRequest,
  ParallelTakeaway as ApiParallelTakeaway,
  TakeawayWithLinksResponse as ApiTakeawayWithLinksResponse,
  UpdateTakeawayRequest as ApiUpdateTakeawayRequest,
} from "@/features/rag/rag-api.generated";

// Renamed for parity with existing call sites in this feature.
export type SourceTakeawayDTO = ApiTakeawayWithLinksResponse;
export type CreateSourceTakeawayRequest = ApiCreateTakeawayRequest;
export type UpdateSourceTakeawayRequest = ApiUpdateTakeawayRequest;
export type ParallelTakeawayDTO = ApiParallelTakeaway;

// TipTap document type — orval represents `body_json` as a permissive record.
export type TakeawayBodyJson = NonNullable<
  ApiTakeawayWithLinksResponse["body_json"]
>;
