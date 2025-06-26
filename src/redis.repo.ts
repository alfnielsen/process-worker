import { createClient } from "redis";

export default class RedisRepo {
  redis: ReturnType<typeof createClient>;
  static async start() {
    const instance = new RedisRepo();
    await instance.redis.connect();
    await instance.redis.configSet("notify-keyspace-events", "Ex");
    return instance;
  }
  private constructor() {
    this.redis = createClient();
  }
  get(key:string) {
    return this.redis.get(key);
  }
  set(key: string, value: string, expire?: number) {
    return this.redis.set(key, value, { EX: expire });
  }
  del(key:string) {
    return this.redis.del(key);
  }
  async getAllKeys(pattern: string) {
    const keys = await this.redis.keys(pattern);
    return keys;
  }
  async getAllValues(pattern: string) {
    const keys = await this.redis.keys(pattern);
    const values = await Promise.all(keys.map(key => this.redis.get(key)));
    return values;
  }
  setReminder(key:string, value:string, expire:number) {
    this.redis
      .multi()
      .set(key, value)
      .set(`reminder:${key}`, 1)
      .expire(`reminder:${key}`, expire)
      .exec();
  }
}