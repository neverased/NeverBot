import { AttachmentBuilder, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import { User as UserModel } from '../../../users/entities/user.entity';
import { UserMessagesService } from '../../../users/messages/messages.service';
import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('privacy-export')
    .setDescription('Export the data NeverBot has collected for you.'),

  async execute(
    interaction: ChatInputCommandInteraction,
    userProfile?: UserModel,
    userMessagesService?: UserMessagesService,
  ) {
    setDiscordResilience(module.exports.execute, {
      timeoutMs: 15000,
      retries: 0,
    });
    await interaction.deferReply({ ephemeral: true });

    if (!userMessagesService) {
      return await interaction.editReply(
        'Message service is unavailable. Cannot export privacy data at this moment.',
      );
    }

    const messages = await userMessagesService.findAllByUserId(
      interaction.user.id,
    );
    const payload = {
      exportedAt: new Date().toISOString(),
      discordUserId: interaction.user.id,
      userProfile: userProfile ?? null,
      messages,
    };
    const attachment = new AttachmentBuilder(
      Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
      { name: `neverbot-privacy-export-${interaction.user.id}.json` },
    );

    await interaction.editReply({
      content: 'Here is your NeverBot data export.',
      files: [attachment],
    });
  },
};
