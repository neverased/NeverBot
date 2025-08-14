import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { DiscordClientProvider } from './discord-client.provider';
import { CommandRegistry } from './command-registry';
import { InteractionHandler } from './interaction-handler';
import { UsersModule } from '../users/users.module';
import { ServersModule } from '../servers/servers.module';
import { WikisModule } from '../wikis/wikis.module';
import { MetricsModule } from '../core/metrics/metrics.module';

@Module({
  imports: [UsersModule, ServersModule, WikisModule, MetricsModule],
  providers: [
    DiscordService,
    DiscordClientProvider,
    CommandRegistry,
    InteractionHandler,
  ],
  exports: [DiscordService],
})
export class DiscordModule {}
