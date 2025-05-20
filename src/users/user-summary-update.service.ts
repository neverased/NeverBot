import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from './users.service';
import { UserMessagesService } from './messages/messages.service';
import openai from '../utils/openai-client';
import { User } from './entities/user.entity';

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
