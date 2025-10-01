import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { ServersService } from '../servers/servers.service';
import { UsersService } from '../users/users.service';

async function migrateServerConfig() {
  const logger = new Logger('MigrateServerConfig');
  logger.log(
    'Starting migration of server config from users to servers collection...',
  );

  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const serversService = app.get(ServersService);

  let migratedCount = 0;
  let skippedCount = 0;

  try {
    const allUsers = await usersService.findAll();
    for (const user of allUsers) {
      // Heuristic: if discordUserId === serverId, treat as server config
      if (
        user.discordUserId &&
        user.serverId &&
        user.discordUserId === user.serverId
      ) {
        const serverId = user.serverId;
        const serverName = user.serverName || 'N/A';
        // Extract server config fields
        interface UserTasks {
          enabledChannels?: string[];
          welcome_channel_id?: string;
          welcomeChannelId?: string;
          [key: string]: unknown;
        }
        const tasks = user.tasks as UserTasks | undefined;
        const enabledChannels = tasks?.enabledChannels || [];
        const welcomeChannelId =
          tasks?.welcome_channel_id || tasks?.welcomeChannelId || '';
        // Add more fields as needed
        await serversService.findOrCreateServer(serverId, serverName);
        await serversService.updateServerByDiscordServerId(serverId, {
          serverName,
          enabledChannels,
          welcomeChannelId,
        });
        logger.log(`Migrated server config for serverId: ${serverId}`);
        migratedCount++;
      } else {
        skippedCount++;
      }
    }
    logger.log(
      `Migration complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`,
    );
  } catch (error) {
    logger.error('Migration failed:', error);
  } finally {
    await app.close();
    logger.log('Application context closed.');
  }
}

migrateServerConfig().catch((error) => {
  console.error('Unhandled error in migration script:', error);
  process.exit(1);
});
