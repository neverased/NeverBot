import OpenAI from 'openai';

import { callChatCompletion } from '../../shared/openai/chat';
import { getOpenAiFlowPolicy } from '../../shared/openai/model-policy';
import { User as UserModel } from '../../users/entities/user.entity';
import { UserMessagesService } from '../../users/messages/messages.service';
import {
  buildNeverBotSystemPrompt,
  buildUntrustedProfileContextMessage,
  NEVERBOT_FEW_SHOT_MESSAGES,
} from './prompts';

export async function generateOpenAiReplyWithState(
  question: string,
  userName: string,
  userProfile?: UserModel,
  userMessagesService?: UserMessagesService,
  priorConversationId?: string,
  imageUrls?: string[],
  contextMessages?: Array<OpenAI.Chat.ChatCompletionMessageParam>,
): Promise<{ content: string | null; conversationId?: string }> {
  const messagesForOpenAI: Array<OpenAI.Chat.ChatCompletionMessageParam> = [
    { role: 'system', content: buildNeverBotSystemPrompt(userName) },
    ...NEVERBOT_FEW_SHOT_MESSAGES,
  ];

  const profileContextMessage = buildUntrustedProfileContextMessage(
    userName,
    userProfile?.personalitySummary,
  );
  if (profileContextMessage) {
    messagesForOpenAI.push(profileContextMessage);
  }
  if (contextMessages && contextMessages.length > 0) {
    messagesForOpenAI.push(...contextMessages);
  }

  // Build the user message with optional images
  if (imageUrls && imageUrls.length > 0) {
    const contentParts: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [];

    // Add text content if present, otherwise use placeholder for image-only messages
    const textContent = question.trim() || 'What do you think?';
    contentParts.push({ type: 'text', text: textContent });

    // Add all images
    for (const imageUrl of imageUrls) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: imageUrl },
      });
    }

    messagesForOpenAI.push({ role: 'user', content: contentParts });
  } else {
    messagesForOpenAI.push({ role: 'user', content: question });
  }

  const policy = getOpenAiFlowPolicy('chat');
  const response = await callChatCompletion(messagesForOpenAI, {
    flow: 'chat',
    model: policy.model,
    maxCompletionTokens: policy.maxCompletionTokens,
    conversation: priorConversationId ? { id: priorConversationId } : undefined,
    reasoning: policy.reasoning,
    text: policy.text,
    promptCacheKey: policy.promptCacheKey,
  });
  const content = response.content ?? null;
  return { content, conversationId: response.conversationId };
}
