import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { PersonalityService } from '../users/personality/personality.service';
import { UsersService } from '../users/users.service';

async function refreshPersonalitySummaries(): Promise<void> {
  const logger = new Logger('RefreshPersonalitySummaries');
  const force = process.argv.includes('--force');
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const personalityService = app.get(PersonalityService);

  try {
    const users = await usersService.findAll();
    logger.log(
      `Checking ${users.length} users for personality refresh. force=${force}`,
    );

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      const result = await personalityService.maybeRefreshPersonalitySummary(
        user.discordUserId,
        { force },
      );
      if (result.status === 'updated') {
        updated++;
        logger.log(`Updated personality summary for ${user.discordUserId}`);
      } else if (result.status === 'error') {
        errors++;
        logger.warn(
          `Failed personality summary for ${user.discordUserId}: ${result.error}`,
        );
      } else {
        skipped++;
      }
    }

    logger.log(
      `Personality refresh complete. updated=${updated} skipped=${skipped} errors=${errors}`,
    );
  } finally {
    await app.close();
  }
}

refreshPersonalitySummaries().catch((error) => {
  console.error('Unhandled error in personality refresh script:', error);
  process.exit(1);
});
