import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AppService } from './app.service';
import { MetricsService } from './core/metrics/metrics.service';
import { DISCORD_HEALTH, DiscordHealth } from './discord/discord-health';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly metricsService: MetricsService,
    @Inject(DISCORD_HEALTH)
    private readonly discordHealth: DiscordHealth,
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
    if (!this.discordHealth.isReady()) {
      throw new ServiceUnavailableException('Discord client is not ready');
    }
    return 'ready';
  }

  @Get('metrics')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
