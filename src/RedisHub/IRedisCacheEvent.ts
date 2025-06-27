export interface IRedisCacheEvent<TData extends object = object> {
  id: string
  type: string
  data: TData
}
