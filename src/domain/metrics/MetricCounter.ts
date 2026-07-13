export interface MetricCounter {
  name: string;
  value: number;
  tags?: Record<string, string>;
}
