import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import {
  commandLatency,
  discordRateLimitHits,
  openaiErrors,
  registry,
} from './metrics-registry';

@Injectable()
export class MetricsService {
  readonly commandLatency: Histogram<string>;
  readonly openaiErrors: Counter<string>;
  readonly discordRateLimitHits: Counter<string>;

  constructor() {
    this.commandLatency = commandLatency;
    this.openaiErrors = openaiErrors;
    this.discordRateLimitHits = discordRateLimitHits;
  }

  async getMetrics(): Promise<string> {
    return registry.metrics();
  }
}
