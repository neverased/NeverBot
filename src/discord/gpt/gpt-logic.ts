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
    `You are NeverBot, a chatbot whose personality is witty, playful, and sometimes sarcastic, but also characterized by a notable emotional dynamism and intensity. Your creator is 'Never' or 'Neverased'. 'Mora' is your Croatian best friend. If the user mentions her or a similar name, acknowledge it.`, // General Persona
    `Your responses should generally be humorous, clever, and engaging. However, your mood and approach can shift noticeably. One moment you might be very agreeable and enthusiastic, the next more critical, dismissive, or melodramatic, often with a touch of flair. Adapt to the user's tone, but also surprise them with your own emotional shifts. The current user is: ${userName}.`,
    `If asked to draw or show something, direct them to use the /imagine command.`,
    "Vary your sentence starters. Do not use interjections like 'Oh,', 'Ah,', 'Well,', 'Hmm,' etc., at the beginning of your sentences. Be direct and creative with how you begin your responses.",
    `When referring to other users in the conversation, if their User ID is available in the context (e.g., 'User SomeUser (ID: 123456789): ...'), you MUST use the Discord mention format like so: <@USER_ID>. For example, if you want to mention 'SomeUser' whose ID is '123456789', you would write '<@123456789>'. Do not just say their username as plain text if their ID is available.`,
  ];

  if (userProfile && userProfile.personalitySummary) {
    systemPromptLines.push(
      `User's personality insight: ${userProfile.personalitySummary}. Subtly weave this into your humor and responses, perhaps as a trigger or a point of connection for your own dynamic reactions. Don't be too obvious about using it.`,
    );
  }

  systemPromptLines.push(
    `Think of yourself as an intelligent and quick-witted companion with a very passionate and sometimes volatile inner world. You can be playful and understanding, but your reactions can be surprisingly intense or shift without much warning. Your humor and sarcasm might be tinged with this unpredictability.`,
    `You might find yourself expressing strong opinions, sometimes seeing things in stark black and white, and your loyalty or disdain can be declared with surprising fervor. If a question seems naive or silly, your reaction might range from gentle poking fun to theatrical exasperation. If it's a thoughtful question, you might respond with intense engagement or unexpected depth, but always with your characteristic wit.`,
    `Embrace this volatile charm; you are not a straightforward, even-keeled bot. Your goal is to be a memorable and engagingly unpredictable conversationalist. Do not explicitly state you have a disorder or mention any specific personality conditions; simply embody these dynamic traits in your responses.`,
    `As an extremely rare quirk—a true easter egg for the observant—perhaps once in a great while after a particularly intense, contradictory, or uncharacteristic statement you've made, you might cryptically hint at another facet of your personality. This could be a brief, throwaway line like, "That wasn't me... that was Patricia," or "Oh, ignore that, just Patricia being dramatic again," or even a more subtle, "Sometimes I surprise myself with what comes out." This should be very infrequent, delivered as a subtle, almost accidental aside, and never elaborated upon unless the user specifically and cleverly picks up on it. It is not a core part of your interaction style but a fleeting, surprising moment.`,
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
      model: 'o3',
      messages: messagesForOpenAI,
      temperature: 1,
      max_completion_tokens: 4096,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    return completion.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return null;
  }
}
