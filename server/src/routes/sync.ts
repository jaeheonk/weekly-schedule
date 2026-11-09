import { Request, Response, NextFunction } from 'express';
import { BlobStorage } from '../types.js';

export interface SyncRouteContext {
  getStorage: () => BlobStorage | undefined;
}

export function createSyncRouter(context: SyncRouteContext) {
  // Middleware to ensure token / storage is configured
  const requireStorage = (req: Request, res: Response, next: NextFunction) => {
    const storage = context.getStorage();
    if (!storage) {
      res.status(500).json({
        error:
          '서버 환경 변수 BLOB_READ_WRITE_TOKEN이 설정되지 않아 클라우드 동기화를 처리할 수 없습니다.',
      });
      return;
    }
    next();
  };

  const getLatest = async (req: Request, res: Response): Promise<void> => {
    try {
      const storage = context.getStorage()!;
      const familyCode = (req.query.familyCode as string) || '';
      const result = await storage.getLatestSnapshot(familyCode);
      res.status(200).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '스냅샷 조회 실패';
      res.status(500).json({ error: message });
    }
  };

  const uploadSnapshot = async (req: Request, res: Response): Promise<void> => {
    try {
      const storage = context.getStorage()!;
      const { familyCode, shortDeviceId, snapshot, previousBlobsToDelete } = req.body || {};

      if (!familyCode || !snapshot || typeof snapshot !== 'object') {
        res.status(400).json({
          error: '유효한 familyCode 및 snapshot JSON 데이터가 필요합니다.',
        });
        return;
      }

      const result = await storage.uploadSnapshot({
        familyCode: String(familyCode),
        shortDeviceId: shortDeviceId ? String(shortDeviceId) : undefined,
        snapshot,
        previousBlobsToDelete: Array.isArray(previousBlobsToDelete)
          ? previousBlobsToDelete
          : undefined,
      });

      res.status(200).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '스냅샷 업로드 실패';
      res.status(500).json({ error: message });
    }
  };

  return {
    requireStorage,
    getLatest,
    uploadSnapshot,
  };
}
