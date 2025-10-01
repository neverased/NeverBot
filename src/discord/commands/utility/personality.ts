import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  User as DiscordUser,
} from 'discord.js';

import { User as UserModel } from '../../../users/entities/user.entity';
import { UserMessagesService } from '../../../users/messages/messages.service';
import { UsersService } from '../../../users/users.service';
import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('personality')
    .setDescription("Displays a user's personality summary, if available.")
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('The user whose personality you want to see.')
        .setRequired(false),
    ),
  async execute(
    interaction: ChatInputCommandInteraction,
    _executorProfile?: UserModel,
    _userMessagesService?: UserMessagesService,
    usersService?: UsersService,
  ) {
    setDiscordResilience(module.exports.execute, {
      timeoutMs: 8000,
      retries: 0,
    });
    await interaction.deferReply();

    if (!usersService) {
      return await interaction.editReply(
        'User service is unavailable. Cannot fetch personality data at this moment.',
      );
    }

    const targetDiscordUser: DiscordUser =
      interaction.options.getUser('target') || interaction.user;

    try {
      const targetUserProfile: UserModel | null =
        await usersService.findOneByDiscordUserId(targetDiscordUser.id);

      if (!targetUserProfile) {
        return await interaction.editReply(
          `I don't have any information about ${targetDiscordUser.username} yet.`,
        );
      }

      if (
        targetUserProfile.personalitySummary &&
        targetUserProfile.personalitySummary.trim() !== '' &&
        !targetUserProfile.personalitySummary
          .toLowerCase()
          .includes('error generating summary')
      ) {
        const personalityEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`${targetDiscordUser.username}'s Personality Snapshot`)
          .setDescription(targetUserProfile.personalitySummary)
          .setThumbnail(targetDiscordUser.displayAvatarURL())
          .setTimestamp()
          .setFooter({ text: 'Based on recent activity and interactions.' });

        await interaction.editReply({ embeds: [personalityEmbed] });
      } else if (
        targetUserProfile.personalitySummary &&
        targetUserProfile.personalitySummary
          .toLowerCase()
          .includes('error generating summary')
      ) {
        await interaction.editReply(
          `I tried to get a read on ${targetDiscordUser.username}, but there was an issue generating their personality summary. Please try again later or ask an admin to regenerate it.`,
        );
      } else {
        await interaction.editReply(
          `I don't have a personality summary for ${targetDiscordUser.username} yet. I'm still observing! Perhaps they need to chat a bit more, or their summary is still being generated.`,
        );
      }
    } catch (error) {
      console.error(
        `Error fetching personality for ${targetDiscordUser.id}:`,
        error,
      );
      await interaction.editReply(
        "couldn't grab that personality summary. something broke on my end.",
      );
    }
  },
};
