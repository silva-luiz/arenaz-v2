/** RFC 9457 `application/problem+json` body returned by the API on errors. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;
}
