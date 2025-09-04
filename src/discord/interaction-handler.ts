import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../core/metrics/metrics.service';
import { ChatInputCommandInteraction, Interaction } from 'discord.js';
import { UsersService } from '../users/users.service';
import { UserMessagesService } from '../users/messages/messages.service';
import { ServersService } from '../servers/servers.service';
import { WikiSearchService } from '../wikis/wikisearch.service';
import { CommandRegistry } from './command-registry';
import { withSafeInteraction } from './safe-discord';
import { getDiscordResilience } from './decorators/discord-resilience.decorator';
import {
  commandErrors,
  commandSuccess,
  commandStarts,
} from '../core/metrics/metrics-registry';

@Injectable()
export class InteractionHandler {
  private readonly logger = new Logger(InteractionHandler.name);

  constructor(
    private readonly commandRegistry: CommandRegistry,
    private readonly usersService: UsersService,
    private readonly userMessagesService: UserMessagesService,
    private readonly serversService: ServersService,
    private readonly wikiSearchService: WikiSearchService,
    private readonly metrics: MetricsService,
  ) {}

  async handle(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      if (interaction.isCommand() && !interaction.isChatInputCommand()) {
        this.logger.warn(
          `Received non-chat input command: ${interaction.commandName}`,
        );
      }
      return;
    }

    const command = this.commandRegistry.get().get(interaction.commandName);
    if (!command) {
      this.logger.error(
        `No command matching ${interaction.commandName} was found.`,
      );
      return;
    }

    try {
      let userProfile: any | undefined = undefined;
      let serverConfig: any = undefined;
      if (interaction.user) {
        try {
          if (interaction.guild) {
            serverConfig = await this.serversService.findOrCreateServer(
              interaction.guild.id,
              interaction.guild.name,
            );
          }
          userProfile = await this.usersService.findOrCreateUser(
            interaction.user.id,
            interaction.guild?.name,
            interaction.guild?.id,
          );
        } catch (err) {
          this.logger.error(
            `Error fetching user/server profile for ${interaction.user.id}:`,
            err as Error,
          );
        }
      }

      if (
        interaction.guild &&
        serverConfig &&
        Array.isArray(serverConfig.enabledChannels) &&
        serverConfig.enabledChannels.length > 0 &&
        !serverConfig.enabledChannels.includes(interaction.channelId)
      ) {
        await interaction.reply({
          content: 'This command is not enabled in this channel.',
          ephemeral: true,
        });
        return;
      }

      const highCard =
        (process.env.METRICS_HIGH_CARD || '').toLowerCase() === 'true';
      const labels = highCard
        ? { command: interaction.commandName }
        : { command: interaction.commandName };
      const endTimer = this.metrics.commandLatency.startTimer(labels);
      try {
        try {
          commandStarts.inc({ command: interaction.commandName });
        } catch {}
        const resilience = getDiscordResilience(command.execute) || {};
        const safe = withSafeInteraction(
          interaction as ChatInputCommandInteraction,
          this.logger,
          resilience,
        );
        await command.execute(
          safe,
          userProfile,
          this.userMessagesService,
          this.usersService,
          this.serversService,
          this.wikiSearchService,
        );
        try {
          commandSuccess.inc({ command: interaction.commandName });
        } catch {}
      } finally {
        endTimer();
      }
    } catch (error) {
      this.logger.error(
        `Error executing command ${interaction.isChatInputCommand() ? interaction.commandName : 'unknown'}:`,
        error as Error,
      );
      try {
        commandErrors.inc({
          command: interaction.isChatInputCommand()
            ? interaction.commandName
            : 'unknown',
          type: (error as Error)?.name || 'Error',
        });
      } catch {}
      try {
        await (interaction as ChatInputCommandInteraction).reply({
          content: 'An error occurred while executing this command.',
          ephemeral: true,
        });
      } catch {}
    }
  }
}
