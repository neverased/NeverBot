import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';

async function cleanupServerConfigFromUsers() {
  const logger = new Logger('CleanupServerConfigFromUsers');
  logger.log('Starting cleanup of server config from users collection...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  let cleanedCount = 0;
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
        // Only keep discordUserId and serverId, set all other fields to safe defaults
        await usersService.updateUserByDiscordUserId(user.discordUserId, {
          discordUserId: user.discordUserId,
          serverId: user.serverId,
          registeredAt: null,
          serverName: '',
          subscription: '',
          tasks: {},
          messageCount: 0,
          lastSeen: null,
          topicsOfInterest: [],
          sentimentHistory: [],
          personalitySummary: '',
        });
        logger.log(
          `Cleaned server config from user document: ${user.discordUserId}`,
        );
        cleanedCount++;
      } else {
        skippedCount++;
      }
    }
    logger.log(
      `Cleanup complete. Cleaned: ${cleanedCount}, Skipped: ${skippedCount}`,
    );
  } catch (error) {
    logger.error('Cleanup failed:', error);
  } finally {
    await app.close();
    logger.log('Application context closed.');
  }
}

cleanupServerConfigFromUsers().catch((error) => {
  console.error('Unhandled error in cleanup script:', error);
  process.exit(1);
});
