import { SlashCommandBuilder } from 'discord.js';
import * as fs from 'fs/promises';
import path from 'path';
import openai from '../../../utils/openai-client';

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
      const changelogPath = path.resolve(__dirname, '../../../CHANGELOG.md');
      const changelogContent = await fs.readFile(changelogPath, 'utf8');
      // Use OpenAI to summarize the changelog in a friendly, human-readable way
      const prompt = `You are a Discord bot. Summarize the following CHANGELOG.md in a friendly, conversational, and human-readable way for users. Use bullet points for each version and highlight the most important changes. Do not include version numbers in the summary if they are not relevant to users. Here is the changelog:

${changelogContent}

Summary:`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      });
      const summary = completion.choices[0]?.message?.content?.trim();
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
