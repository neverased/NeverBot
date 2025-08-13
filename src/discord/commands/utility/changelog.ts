import { SlashCommandBuilder } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { callChatCompletion } from '../../../shared/openai/chat';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('changelog')
    .setDescription('Show a friendly summary of the latest changes.'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();
    try {
      let changelogContent: string | null = null;
      const candidatePaths = [
        path.resolve(__dirname, '../../../../CHANGELOG.md'),
        '/app/CHANGELOG.md',
        path.resolve(process.cwd(), 'CHANGELOG.md'),
      ];
      for (const p of candidatePaths) {
        try {
          changelogContent = await fs.readFile(p, 'utf8');
          break;
        } catch {
          // try next
        }
      }
      if (!changelogContent) {
        await interaction.editReply(
          'CHANGELOG not found in container. Please ensure it is packaged in the image.',
        );
        return;
      }
      // Use OpenAI to summarize the changelog in a friendly, human-readable way
      const prompt = `You are a Discord bot. Summarize the following CHANGELOG.md in a friendly, conversational, and human-readable way for users. Use bullet points for each version and highlight the most important changes from the end user perspective. Do not include infrastructure or just code changes in the summary. Here is the changelog:

${changelogContent}

Summary:`;
      const { content: summary } = await callChatCompletion(
        [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
        { model: 'gpt-5', temperature: 0.7, maxCompletionTokens: 1024 },
      );
      if (!summary) {
        await interaction.editReply(
          'Could not generate a summary of the changelog.',
        );
        return;
      }
      await interaction.editReply(summary);
    } catch (error) {
      console.error('Error generating changelog summary:', error);
      await interaction.editReply('Failed to read or summarize the changelog.');
    }
  },
};
