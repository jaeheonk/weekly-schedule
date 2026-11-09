import {
  CloudSyncSnapshot,
  VercelBlobItem,
  VercelBlobListResponse,
  VercelBlobPutResponse,
} from '../types/snapshot';

export const DEFAULT_VERCEL_BLOB_TOKEN =
  'vercel_blob_rw_z8SmedqOGmynl5Hm_y3N5ZOKGow5ZsDIviQp1VGLRlxJSCT';
export const DEFAULT_FAMILY_CODE = 'family-main';

export interface UploadSnapshotOptions {
  token: string;
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

  public async fetchLatestBlobMetadata(
    token: string,
    familyCode: string
  ): Promise<{ latest: VercelBlobItem | null; allBlobs: VercelBlobItem[] }> {
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      throw new VercelBlobSyncError('Vercel Blob 토큰이 비어 있습니다.');
    }

    const safeFamily = this.sanitizeFamilyCode(familyCode);
    const prefix = `families/${safeFamily}/state-`;
    const cacheBuster = Date.now().toString();

    const query = new URLSearchParams({
      prefix,
      limit: '100',
      _t: cacheBuster,
    });

    const url = `https://blob.vercel-storage.com?${query.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'x-api-version': '7',
        'Cache-Control': 'no-cache',
      },
    });

    await this.validateHTTPResponse(response);

    const data = (await response.json()) as VercelBlobListResponse;
    const blobs = Array.isArray(data.blobs) ? [...data.blobs] : [];

    // 최신 타임스탬프 파일이 맨 앞에 오도록 pathname 내림차순 정렬
    blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));

    return {
      latest: blobs.length > 0 ? blobs[0] : null,
      allBlobs: blobs,
    };
  }

  public async downloadSnapshot(blobURL: string, token: string): Promise<CloudSyncSnapshot> {
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      throw new VercelBlobSyncError('Vercel Blob 토큰이 비어 있습니다.');
    }

    const response = await fetch(blobURL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'Cache-Control': 'no-cache',
      },
    });

    await this.validateHTTPResponse(response);

    return (await response.json()) as CloudSyncSnapshot;
  }

  public async uploadSnapshot(
    snapshot: CloudSyncSnapshot,
    options: UploadSnapshotOptions
  ): Promise<VercelBlobPutResponse> {
    const cleanToken = (options.token || '').trim();
    if (!cleanToken) {
      throw new VercelBlobSyncError('Vercel Blob 토큰이 비어 있습니다.');
    }

    const safeFamily = this.sanitizeFamilyCode(options.familyCode);
    const timestampMs = Date.now();
    const paddedTs = String(timestampMs).padStart(14, '0');
    const pathname = `families/${safeFamily}/state-${paddedTs}-${options.shortDeviceId}.json`;

    const bodyData = JSON.stringify(snapshot);

    const putResult = await this.performPut(
      pathname,
      bodyData,
      cleanToken,
      'private'
    );

    // 업로드 성공 후 이전 스냅샷 파일들 비동기 삭제 (최근 1개만 남겨 스토리지 절약)
    const previousBlobs = options.previousBlobsToDelete || [];
    const urlsToDelete = previousBlobs
      .map((b) => b.url)
      .filter((u) => u && u !== putResult.url);

    if (urlsToDelete.length > 0) {
      // Fire and forget (don't fail the upload if deletion fails)
      this.deleteBlobs(urlsToDelete, cleanToken).catch(() => {
        // non-critical cleanup
      });
    }

    return putResult;
  }

  private async performPut(
    pathname: string,
    bodyData: string,
    token: string,
    accessMode: 'private' | 'public'
  ): Promise<VercelBlobPutResponse> {
    const url = `https://blob.vercel-storage.com/${pathname}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-version': '7',
        'x-content-type': 'application/json',
        'x-vercel-blob-access': accessMode,
        'x-add-random-suffix': '0',
        'x-allow-overwrite': '1',
        'x-cache-control-max-age': '0',
      },
      body: bodyData,
    });

    if (response.status === 400 && accessMode === 'private') {
      let text = '';
      try {
        if (typeof response.clone === 'function') {
          text = await response.clone().text();
        } else {
          text = await response.text();
        }
      } catch {
        // ignore read error
      }
      if (text.toLowerCase().includes('public')) {
        return this.performPut(pathname, bodyData, token, 'public');
      }
    }

    await this.validateHTTPResponse(response);

    return (await response.json()) as VercelBlobPutResponse;
  }

  public async deleteBlobs(urls: string[], token: string): Promise<void> {
    if (!urls || urls.length === 0) return;
    const cleanToken = (token || '').trim();
    if (!cleanToken) return;

    const url = 'https://blob.vercel-storage.com/delete';
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'x-api-version': '7',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      });
    } catch {
      // Ignore background cleanup failures
    }
  }

  private async validateHTTPResponse(response: Response): Promise<void> {
    if (response.ok) return;

    let serverMessage = '';
    try {
      const errorJson = (await response.json()) as { message?: string };
      serverMessage = errorJson?.message || '';
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
