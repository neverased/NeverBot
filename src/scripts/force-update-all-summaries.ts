import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { UserSummaryUpdateService } from '../users/user-summary-update.service';
import { UsersService } from '../users/users.service';

async function forceUpdateAllSummaries() {
  const logger = new Logger('ForceUpdateAllSummaries');
  logger.log(
    'Starting process to force update personality summaries for all relevant users...',
  );

  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const userSummaryUpdateService = app.get(UserSummaryUpdateService);

  let processedCount = 0;
  let errorCount = 0;

  try {
    // Fetch users who have at least one message, as summaries are not generated for users with 0 messages.
    const allUsers = await usersService.findAll(); // You could refine this to use a more specific query if needed
    const relevantUsers = allUsers.filter((user) => user.messageCount > 0);

    logger.log(
      `Found ${relevantUsers.length} users with messageCount > 0 to process.`,
    );

    for (const user of relevantUsers) {
      processedCount++;
      const userId = user.discordUserId;
      try {
        logger.log(
          `Processing user ${processedCount}/${relevantUsers.length}: ${userId}`,
        );
        await userSummaryUpdateService.forceGenerateSummaryForUserById(userId);
        // A small delay to avoid overwhelming the OpenAI API if you have many users
        // Adjust or remove this delay based on your API rate limits and number of users
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      } catch (error) {
        errorCount++;
        logger.error(
          `Error force-updating summary for user ${userId}: ${error.message}`,
          error.stack,
        );
      }
      if (processedCount % 50 === 0) {
        logger.log(
          `Processed ${processedCount}/${relevantUsers.length} users so far...`,
        );
      }
    }

    logger.log('Force summary update process completed.');
    logger.log(
      `Successfully processed (or attempted to process) summaries for ${relevantUsers.length} users.`,
    );
    logger.log(`Encountered ${errorCount} errors during the process.`);
  } catch (error) {
    logger.error(
      'An error occurred during the force summary update process:',
      error.stack,
    );
  } finally {
    await app.close();
    logger.log('Application context closed.');
  }
}

forceUpdateAllSummaries().catch((error) => {
  console.error('Unhandled error in force update all summaries script:', error);
  process.exit(1);
});
