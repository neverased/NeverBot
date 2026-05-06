import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { User } from './entities/user.entity';
import { PersonalitySummaryGenerator } from './personality/personality-summary.generator';
import { UsersService } from './users.service';

@Injectable()
export class UserSummaryUpdateService {
  private readonly logger = new Logger(UserSummaryUpdateService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly personalitySummaryGenerator: PersonalitySummaryGenerator,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Adjust cron expression as needed
  async handleCron() {
    this.logger.log(
      'Starting scheduled personality summary update for active users.',
    );
    try {
      const activeUsers =
        await this.usersService.findActiveUsersForSummaryUpdate(); // This method needs to be created in UsersService

      for (const user of activeUsers) {
        try {
          const summary = await this.generatePersonalitySummaryForUser(user);
          if (summary) {
            await this.usersService.updatePersonalitySummary(
              user.discordUserId,
              summary,
            );
            this.logger.log(
              `Successfully updated personality summary for user ${user.discordUserId}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error updating summary for user ${user.discordUserId}:`,
            error,
          );
        }
      }
      this.logger.log('Finished scheduled personality summary update.');
    } catch (error) {
      this.logger.error(
        'Error during scheduled personality summary update process:',
        error,
      );
    }
  }

  async forceGenerateSummaryForUserById(discordUserId: string): Promise<void> {
    this.logger.log(
      `Force generating personality summary for user ID: ${discordUserId}`,
    );
    try {
      const user =
        await this.usersService.findOneByDiscordUserId(discordUserId);
      if (!user) {
        this.logger.warn(
          `User ${discordUserId} not found. Cannot generate summary.`,
        );
        return;
      }

      // Optional: Check if user is active enough or if a summary already exists and is recent
      // For a forced update, we might bypass some of these checks or make them configurable
      if (user.messageCount === 0) {
        this.logger.log(
          `User ${discordUserId} has 0 messages. Skipping summary generation.`,
        );
        // Potentially update summary to indicate this if desired
        // await this.usersService.updatePersonalitySummary(discordUserId, "User has no messages, summary not generated.");
        return;
      }

      const summary = await this.generatePersonalitySummaryForUser(user);
      if (summary) {
        await this.usersService.updatePersonalitySummary(
          discordUserId,
          summary,
        );
        this.logger.log(
          `Successfully force-updated personality summary for user ${discordUserId}`,
        );
      } else {
        this.logger.warn(
          `Failed to generate summary for user ${discordUserId} during forced update.`,
        );
        // Optionally, update the summary field to indicate an error
        await this.usersService.updatePersonalitySummary(
          discordUserId,
          'Error during forced summary generation.',
        );
      }
    } catch (error) {
      this.logger.error(
        `Error during forceGenerateSummaryForUserById for ${discordUserId}:`,
        error,
      );
      // Attempt to save an error summary to indicate failure
      try {
        await this.usersService.updatePersonalitySummary(
          discordUserId,
          'Critical error during forced summary generation.',
        );
      } catch (updateError) {
        this.logger.error(
          `Failed to update user ${discordUserId} with a critical error summary: ${updateError.message}`,
        );
      }
    }
  }

  private async generatePersonalitySummaryForUser(
    user: User,
  ): Promise<string | null> {
    return this.personalitySummaryGenerator.generateForUser(user);
  }
}
