import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './core/metrics/metrics.service';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): string {
    return 'ok';
  }

  @Get('ready')
  getReady(): string {
    return 'ready';
  }

  @Get('metrics')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
