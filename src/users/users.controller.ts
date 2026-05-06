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
} from '@nestjs/common';
import { mongo } from 'mongoose';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { PersonalitySummaryGenerator } from './personality/personality-summary.generator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly personalitySummaryGenerator: PersonalitySummaryGenerator,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    console.log(createUserDto, 'createUserDto from controller');
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
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

    try {
      this.logger.log(`Sending request to OpenAI for user ${discordUserId}`);
      const summary =
        (await this.personalitySummaryGenerator.generateForUser(user)) ||
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
