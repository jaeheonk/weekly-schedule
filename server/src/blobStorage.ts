import { get, list, put, del } from '@vercel/blob';
import {
  BlobStorage,
  SyncLatestResponse,
  UploadPayload,
  UploadResponse,
  VercelBlobItem,
} from './types.js';

export function sanitizeFamilyCode(raw?: string): string {
  const trimmed = (raw || '').trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9_-]/g, '');
}

// 정리 요청은 같은 가족의 스냅샷 경로만 지운다. 같은 Blob 스토어의 다른 데이터를
// 클라이언트가 보낸 URL로 지우지 못하게 막는다.
export function isFamilySnapshotUrl(rawUrl: string, safeFamily: string): boolean {
  try {
    const pathname = decodeURIComponent(new URL(rawUrl).pathname).replace(/^\/+/, '');
    return pathname.startsWith(`families/${safeFamily}/state-`) && !pathname.includes('..');
  } catch {
    return false;
  }
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
    if (!safeFamily) {
      throw new Error('유효한 familyCode가 필요합니다.');
    }

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
    if (!safeFamily) {
      throw new Error('유효한 familyCode가 필요합니다.');
    }

    const timestampMs = Date.now();
    const paddedTs = String(timestampMs).padStart(14, '0');
    const safeDeviceId = (payload.shortDeviceId || 'web')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 16) || 'web';

    const pathname = `families/${safeFamily}/state-${paddedTs}-${safeDeviceId}.json`;
    const jsonString = JSON.stringify(payload.snapshot);

    const putResult = await put(pathname, jsonString, {
      access: 'private',
      token: this.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });

    // 이전 스냅샷 정리. 서버리스(Vercel Functions)에서는 응답 뒤에 남은 작업이
    // 끊길 수 있어 응답 전에 기다린다. 정리 실패는 업로드 실패로 보지 않는다.
    const previous = payload.previousBlobsToDelete || [];
    const urlsToDelete = previous
      .map((b) => b.url)
      .filter((u) => u && u !== putResult.url && isFamilySnapshotUrl(u, safeFamily));

    if (urlsToDelete.length > 0) {
      try {
        await del(urlsToDelete, { token: this.token });
      } catch (err) {
        console.warn('[VercelBlobStorage] Cleanup failed:', err);
      }
    }

    return {
      url: putResult.url,
      pathname: putResult.pathname,
    };
  }

  private async downloadSnapshot(blobUrl: string): Promise<Record<string, unknown>> {
    const getResult = await get(blobUrl, {
      access: 'private',
      token: this.token,
    });

    if (!getResult || !getResult.stream) {
      throw new Error('스냅샷 본문을 읽을 수 없습니다.');
    }

    const text = await new Response(getResult.stream).text();
    return JSON.parse(text);
  }
}
