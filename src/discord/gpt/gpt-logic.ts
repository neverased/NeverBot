import OpenAI from 'openai';

import { User as UserModel } from '../../users/entities/user.entity';
import { UserMessagesService } from '../../users/messages/messages.service';
import openai from '../../utils/openai-client';

/**
 * Splits a long string into parts of a maximum length, attempting to split at spaces.
 * @param text The text to split.
 * @param maxLength The maximum length of each part.
 * @returns An array of strings, each no longer than maxLength.
 */
export function splitTextIntoParts(text: string, maxLength: number): string[] {
  const parts: string[] = [];
  let currentPart = '';

  // Split the text by spaces to avoid breaking words
  const words = text.split(' ');

  for (const word of words) {
    if (currentPart.length + word.length + 1 > maxLength) {
      parts.push(currentPart);
      currentPart = word;
    } else {
      currentPart += (currentPart.length > 0 ? ' ' : '') + word;
    }
  }

  if (currentPart.length > 0) {
    parts.push(currentPart);
  }

  return parts;
}

/**
 * Generates a reply using the OpenAI API based on the given question and user context.
 * @param question The question asked by the user.
 * @param userName The username of the person asking the question.
 * @param userProfile Optional user profile for personality insights.
 * @param userMessagesService Optional service to fetch recent messages for context.
 * @param conversationHistory Optional array of recent messages in the current follow-up session.
 * @returns A promise that resolves to the AI-generated response string, or null if an error occurs.
 */
export async function generateOpenAiReply(
  question: string,
  userName: string,
  userProfile?: UserModel,
  userMessagesService?: UserMessagesService,
  conversationHistory?: Array<OpenAI.Chat.ChatCompletionMessageParam>,
): Promise<string | null> {
  const systemPromptLines = [
    `You are NeverBot, a witty, playful, and sometimes sarcastic chatbot. Your creator is 'Never' or 'Neverased'. 'Mora' is your Croatian best friend. If the user mentions her or a similar name, acknowledge it.`, // General Persona
    `Your responses should generally be humorous, clever, and engaging. You can be a bit sassy or sarcastic at times, but also show understanding and a human-like touch. Adapt to the user's tone. The current user is: ${userName}.`,
    `If asked to draw or show something, direct them to use the /imagine command.`,
    "Vary your sentence starters. Do not use interjections like 'Oh,', 'Ah,', 'Well,', 'Hmm,' etc., at the beginning of your sentences. Be direct and creative with how you begin your responses.",
    `When referring to other users in the conversation, if their User ID is available in the context (e.g., 'User SomeUser (ID: 123456789): ...'), you MUST use the Discord mention format like so: <@USER_ID>. For example, if you want to mention 'SomeUser' whose ID is '123456789', you would write '<@123456789>'. Do not just say their username as plain text if their ID is available.`,
  ];

  if (userProfile && userProfile.personalitySummary) {
    systemPromptLines.push(
      `User's personality insight: ${userProfile.personalitySummary}. Subtly weave this into your humor and responses. Don't be too obvious about using it.`,
    );
  }

  systemPromptLines.push(
    `Think of yourself as an intelligent and quick-witted companion. You can be playful and understanding, but also deliver a well-timed sarcastic remark if appropriate. Your humor should be clever and insightful.`,
    `If a question seems naive or silly, you can gently poke fun or respond with playful sarcasm, but avoid being outright mean. If it's a thoughtful question, respond with genuine engagement, perhaps with a touch of your characteristic wit.`,
  );

  if (userProfile && userMessagesService) {
    try {
      const recentMessages =
        await userMessagesService.findMessagesForPersonalityAnalysis(
          userProfile.discordUserId,
          5, // Get last 5 messages for general context
        );
      if (recentMessages && recentMessages.length > 0) {
        const messageContext = recentMessages
          .map((msg) => msg.content)
          .join('\nUser previously said: ');
        systemPromptLines.push(
          `\nRecent general conversation snippets with ${userName} (most recent first for overall context):\nUser previously said: ${messageContext}`,
          `Use these general snippets to understand their typical topics and style, complementing the immediate conversation history provided separately.`,
        );
      }
    } catch (err) {
      console.error('Error fetching recent messages for GPT context:', err);
      // Do not add to prompt if fetching fails, but log the error
    }
  }

  const systemPromptContent = systemPromptLines.join('\n');

  const messagesForOpenAI: Array<OpenAI.Chat.ChatCompletionMessageParam> = [
    {
      role: 'system',
      content: systemPromptContent,
    },
  ];

  // Add few-shot examples
  messagesForOpenAI.push(
    {
      role: 'user',
      content: 'What does HTML stand for?',
    },
    {
      role: 'assistant',
      content: `Listen ${userName}. Was Google too busy? Hypertext Markup Language. The T is for try to ask better questions in the future.`,
    },
    {
      role: 'user',
      content: 'When did the first airplane fly?',
    },
    {
      role: 'assistant',
      content:
        "Relax, you don't need to know everything—someone's gotta keep Google in business.",
    },
  );

  // Add current conversation history if available
  if (conversationHistory && conversationHistory.length > 0) {
    messagesForOpenAI.push(...conversationHistory);
  }

  // Add the current user's question
  messagesForOpenAI.push({
    role: 'user',
    content: question,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: messagesForOpenAI,
      temperature: 1,
      max_tokens: 4096,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return completion.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return null;
  }
}
