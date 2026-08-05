export interface SuccessResponse<T = unknown> {
  ok: true;
  data: T;
}

export interface ErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export interface HealthData {
  status: 'up';
  time: string;
  db: 'reachable' | 'down';
}
