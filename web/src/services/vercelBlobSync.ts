import {
  CloudSyncSnapshot,
  VercelBlobItem,
  VercelBlobPutResponse,
} from '../types/snapshot';

export const DEFAULT_FAMILY_CODE = 'family-main';

export interface SyncLatestResult {
  latest: VercelBlobItem | null;
  snapshot: CloudSyncSnapshot | null;
  allBlobs: VercelBlobItem[];
}

function resolveSyncApiBaseUrl(configured?: string): string {
  const raw =
    configured !== undefined ? configured : String(import.meta.env.VITE_SYNC_API_URL ?? '');
  return raw.trim().replace(/\/+$/, '');
}

export interface UploadSnapshotOptions {
  familyCode: string;
  shortDeviceId: string;
  previousBlobsToDelete?: VercelBlobItem[];
}

export class VercelBlobSyncError extends Error {
  public statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'VercelBlobSyncError';
    this.statusCode = statusCode;
  }
}

export class VercelBlobSyncService {
  private static instance: VercelBlobSyncService;
  private readonly apiBaseUrl: string;

  constructor(apiBaseUrl?: string) {
    this.apiBaseUrl = resolveSyncApiBaseUrl(apiBaseUrl);
  }

  public static shared(): VercelBlobSyncService {
    if (!VercelBlobSyncService.instance) {
      VercelBlobSyncService.instance = new VercelBlobSyncService();
    }
    return VercelBlobSyncService.instance;
  }

  public sanitizeFamilyCode(raw: string): string {
    const trimmed = (raw || '').trim().toLowerCase();
    const filtered = trimmed.replace(/[^a-z0-9_-]/g, '');
    return filtered.length > 0 ? filtered : DEFAULT_FAMILY_CODE;
  }

  public async fetchLatestSnapshot(familyCode: string): Promise<SyncLatestResult> {
    const safeFamily = this.sanitizeFamilyCode(familyCode);
    const query = new URLSearchParams({ familyCode: safeFamily });
    const response = await fetch(`${this.apiBaseUrl}/api/sync/latest?${query.toString()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    await this.validateHTTPResponse(response);

    const data = (await response.json()) as Partial<SyncLatestResult>;
    return {
      latest: data.latest ?? null,
      snapshot: data.snapshot ?? null,
      allBlobs: Array.isArray(data.allBlobs) ? data.allBlobs : [],
    };
  }

  public async uploadSnapshot(
    snapshot: CloudSyncSnapshot,
    options: UploadSnapshotOptions
  ): Promise<VercelBlobPutResponse> {
    const safeFamily = this.sanitizeFamilyCode(options.familyCode);
    const response = await fetch(`${this.apiBaseUrl}/api/sync/upload`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        familyCode: safeFamily,
        shortDeviceId: options.shortDeviceId,
        snapshot,
        previousBlobsToDelete: options.previousBlobsToDelete ?? [],
      }),
    });

    await this.validateHTTPResponse(response);

    return (await response.json()) as VercelBlobPutResponse;
  }

  private async validateHTTPResponse(response: Response): Promise<void> {
    if (response.ok) return;

    let serverMessage = '';
    try {
      const errorJson = (await response.json()) as { message?: string; error?: string };
      serverMessage = errorJson?.error || errorJson?.message || '';
    } catch {
      try {
        serverMessage = await response.text();
      } catch {
        serverMessage = '알 수 없는 오류';
      }
    }

    throw new VercelBlobSyncError(
      `동기화 서버 응답 오류 (${response.status}): ${serverMessage || response.statusText}`,
      response.status
    );
  }
}
