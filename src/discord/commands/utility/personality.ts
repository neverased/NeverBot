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
    await interaction.deferReply({ ephemeral: true });

    if (!usersService) {
      return await interaction.editReply(
        'User service is unavailable. Cannot fetch personality data at this moment.',
      );
    }

    const targetDiscordUser: DiscordUser =
      interaction.options.getUser('target') || interaction.user;
    const isSelfLookup = targetDiscordUser.id === interaction.user.id;

    if (!isSelfLookup) {
      return await interaction.editReply(
        'you can only view your own personality snapshot.',
      );
    }

    try {
      const targetUserProfile: UserModel | null =
        await usersService.findOneByDiscordUserId(targetDiscordUser.id);

      if (!targetUserProfile) {
        return await interaction.editReply(
          `I don't have any information about ${targetDiscordUser.username} yet.`,
        );
      }

      if (targetUserProfile.personalitySummaryStatus === 'error') {
        await interaction.editReply(
          'I tried to refresh that personality snapshot, but something broke. Last good snapshot is kept for chat context.',
        );
        return;
      }

      if (
        targetUserProfile.personalitySummary &&
        targetUserProfile.personalitySummary.trim() !== ''
      ) {
        const displaySummary = sanitizePersonalitySummaryForDisplay(
          targetUserProfile.personalitySummary,
        );
        const personalityEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`${targetDiscordUser.username}'s Personality Snapshot`)
          .setDescription(displaySummary)
          .setThumbnail(targetDiscordUser.displayAvatarURL())
          .setTimestamp()
          .setFooter({ text: buildPersonalityFooter(targetUserProfile) });

        await interaction.editReply({ embeds: [personalityEmbed] });
      } else {
        await interaction.editReply(
          `I don't have a personality summary for ${targetDiscordUser.username} yet.`,
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

function sanitizePersonalitySummaryForDisplay(summary: string): string {
  return summary
    .replace(/<@!?\d+>/g, '[mention]')
    .replace(/<@&\d+>/g, '[role]')
    .replace(/<#\d+>/g, '[channel]')
    .replace(/@everyone/gi, 'everyone')
    .replace(/@here/gi, 'here')
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 3500);
}

function buildPersonalityFooter(profile: UserModel): string {
  const scope = buildPersonalityScopeLabel(profile);
  if (!profile.personalitySummaryUpdatedAt) {
    return `Based on recent collected activity${scope}.`;
  }

  return `Based on recent collected activity${scope}. Updated ${new Date(
    profile.personalitySummaryUpdatedAt,
  ).toISOString()}`;
}

function buildPersonalityScopeLabel(profile: UserModel): string {
  const parts: string[] = [];
  if (profile.personalitySummaryGuildCount) {
    parts.push(`${profile.personalitySummaryGuildCount} guild(s)`);
  }
  if (profile.personalitySummaryDmCount) {
    parts.push(`${profile.personalitySummaryDmCount} DM message(s)`);
  }

  return parts.length > 0 ? ` across ${parts.join(', ')}` : '';
}
