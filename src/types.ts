export interface Job {
  id: number;
  task: string;
  payload?: Record<string, unknown>;
  shouldFail?: boolean;
  retryCount?: number;
  priority?: number;
}

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "retrying";