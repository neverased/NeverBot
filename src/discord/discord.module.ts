import { Module } from '@nestjs/common';

import { MetricsModule } from '../core/metrics/metrics.module';
import { ServersModule } from '../servers/servers.module';
import { UsersModule } from '../users/users.module';
import { CommandRegistry } from './command-registry';
import { DiscordService } from './discord.service';
import { DiscordClientProvider } from './discord-client.provider';
import { DISCORD_HEALTH } from './discord-health';
import { InteractionHandler } from './interaction-handler';

@Module({
  imports: [UsersModule, ServersModule, MetricsModule],
  providers: [
    DiscordService,
    DiscordClientProvider,
    CommandRegistry,
    InteractionHandler,
    {
      provide: DISCORD_HEALTH,
      useExisting: DiscordService,
    },
  ],
  exports: [DiscordService, DISCORD_HEALTH],
})
export class DiscordModule {}
