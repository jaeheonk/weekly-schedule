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

export interface BlobStorage {
  getLatestSnapshot(familyCode: string): Promise<SyncLatestResponse>;
  uploadSnapshot(payload: UploadPayload): Promise<UploadResponse>;
}
