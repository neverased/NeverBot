import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import openai from '../utils/openai-client';
import { User } from './entities/user.entity';
import { UserMessagesService } from './messages/messages.service';
import { UsersService } from './users.service';

@Injectable()
export class UserSummaryUpdateService {
  private readonly logger = new Logger(UserSummaryUpdateService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly userMessagesService: UserMessagesService,
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
    const recentMessages =
      await this.userMessagesService.findMessagesForPersonalityAnalysis(
        user.discordUserId,
        20,
      );
    const messageSamples = recentMessages
      .map((msg) => msg.content)
      .join('\\n- ');

    const topics =
      user.topicsOfInterest.length > 0
        ? user.topicsOfInterest.join(', ')
        : 'None apparent';

    let sentimentOverview = 'neutral';
    if (user.sentimentHistory && user.sentimentHistory.length > 0) {
      const positiveCount = user.sentimentHistory.filter(
        (s) => s.sentiment === 'positive',
      ).length;
      const negativeCount = user.sentimentHistory.filter(
        (s) => s.sentiment === 'negative',
      ).length;
      const totalSentiments = user.sentimentHistory.length;
      if (positiveCount / totalSentiments > 0.6)
        sentimentOverview = 'mostly positive';
      else if (negativeCount / totalSentiments > 0.6)
        sentimentOverview = 'mostly negative';
      else if (positiveCount > negativeCount)
        sentimentOverview = 'generally positive';
      else if (negativeCount > positiveCount)
        sentimentOverview = 'generally negative';
    }

    const prompt = `Based on the following user data and recent messages, generate a concise and insightful personality summary (2-3 sentences) for a Discord bot to understand the user better. Focus on their typical communication style, recurring themes in their messages, and main interests. Do not address the user directly.

User Data:
- Topics of Interest (derived from keywords): ${topics}
- Overall Sentiment Pattern: ${sentimentOverview}
- Message Count: ${user.messageCount}

Recent Message Samples (last 20):
- ${messageSamples || 'No recent messages available.'}

Example Summary: "This user is generally positive, frequently discusses gaming and music, and their recent messages show an inquisitive and sometimes humorous communication style. They seem to enjoy detailed explanations."

Generate the personality summary:`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI assistant that generates insightful personality summaries based on user data and message content. Your summaries should be nuanced and capture communication style as well as topics.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      return completion.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      this.logger.error(
        `Error generating summary for user ${user.discordUserId} with OpenAI:`,
        error,
      );
      return null;
    }
  }
}
