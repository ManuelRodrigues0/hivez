export interface TimestampLike {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
}

export function timestampMillis(timestamp?: TimestampLike | null) {
  return timestamp?.toDate?.().getTime() || 0;
}
