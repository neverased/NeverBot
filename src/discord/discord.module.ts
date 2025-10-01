import { Module } from '@nestjs/common';

import { MetricsModule } from '../core/metrics/metrics.module';
import { ServersModule } from '../servers/servers.module';
import { UsersModule } from '../users/users.module';
import { CommandRegistry } from './command-registry';
import { DiscordService } from './discord.service';
import { DiscordClientProvider } from './discord-client.provider';
import { InteractionHandler } from './interaction-handler';

@Module({
  imports: [UsersModule, ServersModule, MetricsModule],
  providers: [
    DiscordService,
    DiscordClientProvider,
    CommandRegistry,
    InteractionHandler,
  ],
  exports: [DiscordService],
})
export class DiscordModule {}
