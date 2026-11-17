export interface VercelBlobItem {
  url: string;
  pathname: string;
  size?: number;
  uploadedAt?: string | Date;
}

export interface SyncLatestResponse {
  latest: VercelBlobItem | null;
  snapshot: Record<string, unknown> | null;
  allBlobs: VercelBlobItem[];
}

export interface UploadPayload {
  familyCode: string;
  shortDeviceId?: string;
  snapshot: Record<string, unknown>;
  previousBlobsToDelete?: VercelBlobItem[];
}

export interface UploadResponse {
  url: string;
  pathname: string;
}

/**
 * 동기화 저장소 인터페이스. HTTP API(`/api/sync/latest`, `/api/sync/upload`)는
 * 이 두 메서드만 쓴다. 어댑터: RedisSyncStorage(기본), VercelBlobStorage(마이그레이션용).
 */
export interface SyncStorage {
  getLatestSnapshot(familyCode: string): Promise<SyncLatestResponse>;
  uploadSnapshot(payload: UploadPayload): Promise<UploadResponse>;
}

/** @deprecated SyncStorage를 쓴다. 기존 코드 호환용 별칭. */
export type BlobStorage = SyncStorage;
