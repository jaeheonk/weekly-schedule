import { RedisLike } from '../redisStorage.js';

/** 테스트용 메모리 Redis. Upstash처럼 값을 JSON으로 저장하고 읽을 때 되살린다. */
export class MemoryRedis implements RedisLike {
  public readonly data = new Map<string, string>();
  public readonly calls: Array<{ op: 'get' | 'set'; key: string }> = [];

  async get<T>(key: string): Promise<T | null> {
    this.calls.push({ op: 'get', key });
    const raw = this.data.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown): Promise<'OK'> {
    this.calls.push({ op: 'set', key });
    this.data.set(key, JSON.stringify(value));
    return 'OK';
  }
}
