import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
// import openai from '../../../utils/openai-client'; - Removed, OpenAI client is in gpt-logic
import { User as UserModel } from '../../../users/entities/user.entity';
import { UserMessagesService } from '../../../users/messages/messages.service';
import { generateOpenAiReply, splitTextIntoParts } from '../../gpt/gpt-logic'; // Corrected path

// function splitText(text, maxLength) { ... } // Removed, using splitTextIntoParts from gpt-logic

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
  ) {
    await interaction.deferReply();
    const question = interaction.options.getString('question');
    const userName = interaction.user.globalName || interaction.user.username;

    if (!question) {
      return await interaction.editReply('Please provide a question!');
    }

    // System prompt generation and OpenAI call are now in generateOpenAiReply
    // let systemPromptLines = [ ... ]; // Removed
    // const systemPromptContent = systemPromptLines.join('\n'); // Removed

    try {
      const gptResponse = await generateOpenAiReply(
        question,
        userName,
        userProfile,
        userMessagesService,
      );

      if (!gptResponse) {
        await interaction.editReply(
          "Sorry, I had a moment of existential dread and couldn't come up with a response. Try again?",
        );
        return;
      }

      // Directly use gptResponse, removing the Q: A: format
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
      await interaction.editReply(
        'Sorry, I ran into a problem trying to answer that. Maybe ask something less complicated?',
      );
    }
  },
};
