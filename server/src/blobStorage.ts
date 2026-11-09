import { get, list, put, del } from '@vercel/blob';
import {
  BlobStorage,
  SyncLatestResponse,
  UploadPayload,
  UploadResponse,
  VercelBlobItem,
} from './types.js';

export const DEFAULT_FAMILY_CODE = 'family-main';

export function sanitizeFamilyCode(raw?: string): string {
  const trimmed = (raw || '').trim().toLowerCase();
  const filtered = trimmed.replace(/[^a-z0-9_-]/g, '');
  return filtered.length > 0 ? filtered : DEFAULT_FAMILY_CODE;
}

export class VercelBlobStorage implements BlobStorage {
  private token: string;

  constructor(token: string) {
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      throw new Error('BLOB_READ_WRITE_TOKEN이 비어 있습니다.');
    }
    this.token = cleanToken;
  }

  public async getLatestSnapshot(familyCode: string): Promise<SyncLatestResponse> {
    const safeFamily = sanitizeFamilyCode(familyCode);
    const prefix = `families/${safeFamily}/state-`;

    const listResult = await list({
      prefix,
      limit: 100,
      token: this.token,
    });

    const blobs: VercelBlobItem[] = (listResult.blobs || []).map((b) => ({
      url: b.url,
      pathname: b.pathname,
      size: b.size,
      uploadedAt: b.uploadedAt,
    }));

    // 최신 타임스탬프가 맨 앞에 오도록 pathname 내림차순 정렬
    blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));

    if (blobs.length === 0) {
      return {
        latest: null,
        snapshot: null,
        allBlobs: [],
      };
    }

    const latest = blobs[0];
    const snapshot = await this.downloadSnapshot(latest.url);

    return {
      latest,
      snapshot,
      allBlobs: blobs,
    };
  }

  public async uploadSnapshot(payload: UploadPayload): Promise<UploadResponse> {
    const safeFamily = sanitizeFamilyCode(payload.familyCode);
    const timestampMs = Date.now();
    const paddedTs = String(timestampMs).padStart(14, '0');
    const safeDeviceId = (payload.shortDeviceId || 'web')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 16) || 'web';

    const pathname = `families/${safeFamily}/state-${paddedTs}-${safeDeviceId}.json`;
    const jsonString = JSON.stringify(payload.snapshot);

    let putResult: { url: string; pathname: string };
    try {
      putResult = await put(pathname, jsonString, {
        access: 'private',
        token: this.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.toLowerCase().includes('public')) {
        // Fallback for buckets configured for public access
        putResult = await put(pathname, jsonString, {
          access: 'public',
          token: this.token,
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json',
        });
      } else {
        throw err;
      }
    }

    // Fire-and-forget 비동기 정리
    const previous = payload.previousBlobsToDelete || [];
    const urlsToDelete = previous
      .map((b) => b.url)
      .filter((u) => u && u !== putResult.url);

    if (urlsToDelete.length > 0) {
      del(urlsToDelete, { token: this.token }).catch((err) => {
        console.warn('[VercelBlobStorage] Background cleanup failed:', err);
      });
    }

    return {
      url: putResult.url,
      pathname: putResult.pathname,
    };
  }

  private async downloadSnapshot(blobUrl: string): Promise<Record<string, unknown>> {
    try {
      const getResult = await get(blobUrl, {
        access: 'private',
        token: this.token,
      });

      if (getResult && getResult.stream) {
        const text = await new Response(getResult.stream).text();
        return JSON.parse(text);
      }
    } catch {
      // Fallback: authorized fetch
    }

    const res = await fetch(blobUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Cache-Control': 'no-cache',
      },
    });

    if (!res.ok) {
      throw new Error(`스냅샷 다운로드 실패 (${res.status}): ${res.statusText}`);
    }

    return (await res.json()) as Record<string, unknown>;
  }
}
