import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { UserMessagesService } from '../users/messages/messages.service';
import { Logger } from '@nestjs/common';
import { UpdateUserDto } from '../users/dto/update-user.dto';

async function backfillMessageCounts() {
  const logger = new Logger('BackfillMessageCounts');
  logger.log('Starting backfill process for user message counts...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const userMessagesService = app.get(UserMessagesService);

  let updatedCount = 0;
  let checkedCount = 0;

  try {
    const allUsers = await usersService.findAll();
    logger.log(`Found ${allUsers.length} users to check.`);

    for (const user of allUsers) {
      checkedCount++;
      const userId = user.discordUserId;
      try {
        const messages = await userMessagesService.findAllByUserId(userId);
        const actualMessageCount = messages.length;

        if (user.messageCount !== actualMessageCount) {
          logger.log(
            `User ${userId}: current DB count is ${user.messageCount}, actual count is ${actualMessageCount}. Updating...`,
          );
          await usersService.updateUserByDiscordUserId(userId, {
            messageCount: actualMessageCount,
          } as UpdateUserDto);
          updatedCount++;
          logger.log(
            `User ${userId}: messageCount updated to ${actualMessageCount}.`,
          );
        } else {
          // logger.log(`User ${userId}: messageCount (${user.messageCount}) is already correct.`);
        }
      } catch (error) {
        logger.error(
          `Error processing user ${userId}: ${error.message}`,
          error.stack,
        );
      }
      if (checkedCount % 100 === 0) {
        logger.log(
          `Processed ${checkedCount}/${allUsers.length} users so far...`,
        );
      }
    }

    logger.log('Backfill process completed.');
    logger.log(`Checked ${allUsers.length} users.`);
    logger.log(`Updated message counts for ${updatedCount} users.`);
  } catch (error) {
    logger.error('An error occurred during the backfill process:', error.stack);
  } finally {
    await app.close();
    logger.log('Application context closed.');
  }
}

backfillMessageCounts().catch((error) => {
  console.error('Unhandled error in backfill script:', error);
  process.exit(1);
});
