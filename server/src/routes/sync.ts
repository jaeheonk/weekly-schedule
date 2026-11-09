import { Request, Response, NextFunction, Router } from 'express';
import { BlobStorage } from '../types.js';
import { handleHealthCheck } from './health.js';

export interface SyncRouteContext {
  getStorage: () => BlobStorage | undefined;
}

export function createSyncRouter(context: SyncRouteContext): Router {
  const router = Router();

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
      const storage = context.getStorage();
      if (!storage) {
        res.status(500).json({
          error:
            '서버 환경 변수 BLOB_READ_WRITE_TOKEN이 설정되지 않아 클라우드 동기화를 처리할 수 없습니다.',
        });
        return;
      }

      const familyCode = (req.query.familyCode as string) || '';
      if (!familyCode.trim()) {
        res.status(400).json({
          error: '유효한 familyCode 쿼리 파라미터가 필요합니다.',
        });
        return;
      }

      const result = await storage.getLatestSnapshot(familyCode);
      res.status(200).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '스냅샷 조회 실패';
      res.status(500).json({ error: message });
    }
  };

  const uploadSnapshot = async (req: Request, res: Response): Promise<void> => {
    try {
      const storage = context.getStorage();
      if (!storage) {
        res.status(500).json({
          error:
            '서버 환경 변수 BLOB_READ_WRITE_TOKEN이 설정되지 않아 클라우드 동기화를 처리할 수 없습니다.',
        });
        return;
      }

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

  // Mount sync routes
  router.get('/health', handleHealthCheck);
  router.get('/latest', requireStorage, getLatest);
  router.post('/upload', requireStorage, uploadSnapshot);

  return router;
}
