import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import { ServersService } from '../../../servers/servers.service';
import { splitTextIntoParts } from '../../../shared/utils/text-splitter';
import { User as UserModel } from '../../../users/entities/user.entity';
import { UserMessagesService } from '../../../users/messages/messages.service';
import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';
import { generateOpenAiReplyWithState } from '../../gpt/gpt-logic';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('You can ask me anything!')
    .addStringOption((option) =>
      option.setName('question').setDescription('The question you want to ask'),
    ),
  async execute(
    interaction: ChatInputCommandInteraction,
    userProfile?: UserModel,
    userMessagesService?: UserMessagesService,
    _usersService?: unknown,
    serversService?: ServersService,
  ) {
    // Allow a longer timeout for LLM responses; modest retry
    setDiscordResilience(module.exports.execute, {
      timeoutMs: 30000,
      retries: 1,
    });
    await interaction.deferReply();
    const question = interaction.options.getString('question');
    const userName = interaction.user.globalName || interaction.user.username;

    if (!question) {
      return await interaction.editReply('Please provide a question!');
    }

    try {
      let priorConversationId: string | undefined = undefined;
      if (interaction.guild && serversService) {
        try {
          priorConversationId = await serversService.getChannelConversationId(
            interaction.guild.id,
            interaction.channelId,
          );
        } catch {
          // Ignore errors fetching conversation ID
        }
      }
      const { content: gptResponse, conversationId } =
        await generateOpenAiReplyWithState(
          question,
          userName,
          userProfile,
          userMessagesService,
          priorConversationId,
        );
      if (conversationId && interaction.guild && serversService) {
        try {
          await serversService.setChannelConversationId(
            interaction.guild.id,
            interaction.channelId,
            conversationId,
          );
        } catch {
          // Ignore errors saving conversation ID
        }
      }

      if (!gptResponse) {
        const errorReplies = [
          'my brain just blue-screened. give me a sec and try again?',
          'took too long to think of something clever. ask me again?',
          'connection timed out on my end. hit me up again in a minute',
          'brain.exe has stopped responding. try that again?',
        ];
        await interaction.editReply(
          errorReplies[Math.floor(Math.random() * errorReplies.length)],
        );
        return;
      }

      const response = gptResponse;
      const maxDiscordMessageLength = 2000;

      if (response.length > maxDiscordMessageLength) {
        const responseParts = splitTextIntoParts(
          response,
          maxDiscordMessageLength,
        );
        // For slash commands, the first part can be an editReply, subsequent are followUps.
        await interaction.editReply(responseParts[0]);
        for (let i = 1; i < responseParts.length; i++) {
          await interaction.followUp(responseParts[i]);
        }
      } else {
        await interaction.editReply(response);
      }
    } catch (error) {
      console.error('Error executing ask command:', error);
      const errorReplies = [
        'something went sideways on my end. try asking again?',
        "yeah that didn't work. give it another shot?",
        'hit a snag there. mind trying that again?',
      ];
      await interaction.editReply(
        errorReplies[Math.floor(Math.random() * errorReplies.length)],
      );
    }
  },
};
