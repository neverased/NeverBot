import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import { UsersService } from '../../../users/users.service';
import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';

const CONFIRMATION_TEXT = 'DELETE';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('privacy-delete')
    .setDescription('Delete your NeverBot user profile and collected messages.')
    .addStringOption((option) =>
      option
        .setName('confirm')
        .setDescription(`Type ${CONFIRMATION_TEXT} to delete your data.`)
        .setRequired(true),
    ),

  async execute(
    interaction: ChatInputCommandInteraction,
    _userProfile: unknown,
    _userMessagesService: unknown,
    usersService?: UsersService,
  ) {
    setDiscordResilience(module.exports.execute, {
      timeoutMs: 15000,
      retries: 0,
    });
    await interaction.deferReply({ ephemeral: true });

    if (!usersService) {
      return await interaction.editReply(
        'User service is unavailable. Cannot delete privacy data at this moment.',
      );
    }

    const confirmation = interaction.options.getString('confirm');
    if (confirmation !== CONFIRMATION_TEXT) {
      return await interaction.editReply(
        `Data was not deleted. Run the command again with confirm=${CONFIRMATION_TEXT}.`,
      );
    }

    await usersService.removeByDiscordUserId(interaction.user.id);
    await interaction.editReply(
      'Your NeverBot user profile and collected messages were deleted.',
    );
  },
};
