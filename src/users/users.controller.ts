import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { mongo } from 'mongoose';

import openai from '../utils/openai-client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserMessagesService } from './messages/messages.service';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly userMessagesService: UserMessagesService,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    console.log(createUserDto, 'createUserDto from controller');
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(@Query() _paginationQuery) {
    return this.usersService.findAll();
  }

  @Get(':discordUserId')
  findOne(@Param('discordUserId') discordUserId: string) {
    return this.usersService.findOneByDiscordUserId(discordUserId);
  }

  @Post(':discordUserId/summarize')
  async generatePersonalitySummary(
    @Param('discordUserId') discordUserId: string,
  ): Promise<User> {
    this.logger.log(
      `Attempting to generate personality summary for user ID: ${discordUserId}`,
    );
    let user: User;
    try {
      user = await this.usersService.findOneByDiscordUserId(discordUserId);
    } catch (error) {
      this.logger.error(
        `User not found for summary generation: ${discordUserId}`,
        error.stack,
      );
      throw new NotFoundException(
        `User with Discord ID #${discordUserId} not found for summary generation`,
      );
    }
    this.logger.log(`User ${discordUserId} found. Fetching recent messages.`);

    // Fetch recent messages for richer context
    let recentMessages = [];
    try {
      recentMessages =
        await this.userMessagesService.findMessagesForPersonalityAnalysis(
          discordUserId,
          20,
        );
      this.logger.log(
        `Fetched ${recentMessages.length} messages for user ${discordUserId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not fetch messages for user ${discordUserId} during summary generation: ${error.message}`,
        error.stack,
      );
      // Continue without messages if fetching fails
    }
    const messageSamples = recentMessages
      .map((msg) => msg.content)
      .join('\\n- ');

    const topics =
      user.topicsOfInterest.length > 0
        ? user.topicsOfInterest.join(', ')
        : 'None apparent';

    let sentimentOverview = 'neutral';
    if (user.sentimentHistory.length > 0) {
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
    this.logger.debug(
      `Generated prompt for OpenAI for user ${discordUserId}:\n${prompt}`,
    );

    try {
      this.logger.log(`Sending request to OpenAI for user ${discordUserId}`);
      const completion = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI assistant that generates insightful personality summaries based on user data and message content. Your summaries should be nuanced and capture communication style as well as topics.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_completion_tokens: 150,
      });

      const summary =
        completion.choices[0]?.message?.content?.trim() ||
        'Could not generate summary.';
      this.logger.log(
        `Received summary from OpenAI for user ${discordUserId}: "${summary}"`,
      );
      return this.usersService.updatePersonalitySummary(discordUserId, summary);
    } catch (error) {
      this.logger.error(
        `Error generating personality summary with OpenAI for user ${discordUserId}: ${error.message}`,
        error.stack,
      );
      // Attempt to save an error summary to indicate failure
      try {
        return await this.usersService.updatePersonalitySummary(
          discordUserId,
          'Error generating summary due to OpenAI API failure.',
        );
      } catch (updateError) {
        this.logger.error(
          `Failed to even update user ${discordUserId} with an error summary: ${updateError.message}`,
          updateError.stack,
        );
        throw error;
      }
    }
  }

  @Patch(':discordUserId')
  update(
    @Param('discordUserId') discordUserId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUserByDiscordUserId(
      discordUserId,
      updateUserDto,
    );
  }

  @Delete(':discordUserId')
  remove(
    @Param('discordUserId') discordUserId: string,
  ): Promise<mongo.DeleteResult> {
    return this.usersService.removeByDiscordUserId(discordUserId);
  }
}
