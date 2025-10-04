import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ActivityType,
  ChatInputCommandInteraction,
  Client,
  Collection,
  CommandInteraction,
  DMChannel,
  Events,
  GuildMember,
  Interaction,
  Message,
  MessageReaction,
  NewsChannel,
  TextChannel,
  ThreadChannel,
  User as DiscordUserType,
} from 'discord.js';
import * as natural from 'natural';
import * as path from 'path';

import { discordRateLimitHits } from '../core/metrics/metrics-registry';
import { Server } from '../servers/schemas/server.schema';
import { ServersService } from '../servers/servers.service';
import { callChatCompletion } from '../shared/openai/chat';
import { splitTextIntoParts } from '../shared/utils/text-splitter';
import { User as UserModel } from '../users/entities/user.entity';
import { CreateUserMessageDto } from '../users/messages/dto/create-user-message.dto';
import { UserMessagesService } from '../users/messages/messages.service';
import { UsersService } from '../users/users.service';
import { CommandRegistry } from './command-registry';
import { DiscordClientProvider } from './discord-client.provider';
import { generateOpenAiReplyWithState } from './gpt/gpt-logic';
import { InteractionHandler } from './interaction-handler';
import { textFromImage } from './translator/cv_scrape';
import { translateText } from './translator/translate';
import { discordFlagToLanguageCode } from './translator/translate';

interface Command {
  data: { name: string; description?: string };
  execute: (
    interaction: ChatInputCommandInteraction,
    userProfile?: UserModel,
    userMessagesService?: UserMessagesService,
    usersService?: UsersService,
    serversService?: ServersService,
  ) => Promise<void>;
}

// Define a type for our conversation context cache
interface ConversationContext {
  lastBotReplyTimestamp: number;
  lastBotMessageId?: string; // Optional: to fetch bot's own last message for context
  lastUserMessageId: string; // The user message that the bot last replied to or was a follow-up to
  conversationId?: string; // Responses API conversation id for server-managed state
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}

@Injectable()
export class DiscordService implements OnModuleInit {
  private readonly logger = new Logger(DiscordService.name);
  private readonly token = process.env.BOT_TOKEN;
  private readonly client: Client;
  // Cache for recent conversations: key is `channelId-userId`
  private conversationContextCache: Map<string, ConversationContext> =
    new Map();
  private readonly CONVERSATION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
  // Rate limiting: key is userId, value is array of timestamps
  private userRateLimits: Map<string, number[]> = new Map();
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  private readonly MAX_REQUESTS_PER_WINDOW = 10;
  // Message processing queue to prevent race conditions
  private processingMessages: Set<string> = new Set();

  constructor(
    private readonly usersService: UsersService,
    private readonly userMessagesService: UserMessagesService,
    private readonly serversService: ServersService,
    private readonly discordClientProvider: DiscordClientProvider,
    private readonly commandRegistry: CommandRegistry,
    private readonly interactionHandler: InteractionHandler,
  ) {
    this.validateToken();
    this.client = this.discordClientProvider.create();
    this.client.commands = new Collection<string, Command>();
  }

  private validateToken(): void {
    if (!this.token) {
      this.logger.error('BOT_TOKEN environment variable is not set.');
      throw new Error('BOT_TOKEN environment variable is not set.');
    }
  }

  private initializeClient(): Client {
    return this.discordClientProvider.create();
  }

  private async loadCommands(): Promise<void> {
    const foldersPath = path.join(__dirname, 'commands');
    await this.commandRegistry.loadFromFolder(foldersPath);
    // Mirror registry into client.commands for existing usage
    this.client.commands = this.commandRegistry.get();
  }

  async onModuleInit(): Promise<void> {
    this.registerInteractionCreateHandler();
    this.registerClientReadyHandler();
    this.registerMessageReactionAddHandler();
    this.registerMessageCreateHandler();
    this.registerGuildMemberAddHandler();
    this.registerGuildMemberRemoveHandler();
    await this.loadCommands();
    await this.loginClient();
    this.startCacheCleanupInterval();
  }

  private registerInteractionCreateHandler(): void {
    this.client.on(Events.InteractionCreate, (i: Interaction) => {
      void this.interactionHandler.handle(i);
    });
  }

  private registerClientReadyHandler(): void {
    this.client.on(Events.ClientReady, () => {
      this.logger.log('Client is ready!');
      this.setClientActivity();
      this.registerRateLimitHandler();
    });
  }

  private registerMessageReactionAddHandler(): void {
    this.client.on(
      Events.MessageReactionAdd,
      async (reaction: MessageReaction, user: DiscordUserType) => {
        await this.handleMessageReaction(reaction, user);
      },
    );
  }

  private registerGuildMemberAddHandler(): void {
    this.client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      try {
        const serverId = member.guild.id;
        const serverName = member.guild.name;
        const serverConfig = await this.serversService.findOrCreateServer(
          serverId,
          serverName,
        );
        const welcomeChannelId = serverConfig?.welcomeChannelId;
        if (!welcomeChannelId) return;

        const channel = member.guild.channels.cache.get(welcomeChannelId);
        if (!channel || !(channel instanceof TextChannel)) return;

        const { content } = await callChatCompletion(
          [
            {
              role: 'system',
              content:
                "You're NeverBot, chatting naturally on Discord. You're welcoming a new person. Be casual and friendly, not over-the-top. Keep it short—2-3 sentences max.",
            },
            {
              role: 'user',
              content: `Someone new just joined: ${member.user.username}. Welcome them briefly and mention /help exists if they need it.`,
            },
          ],
          {
            model: 'gpt-5',
            maxCompletionTokens: 150,
            reasoning: { effort: 'low' },
            text: { verbosity: 'low' },
          },
        );

        const description = content ?? `Welcome, <@${member.user.id}>!`;
        await channel.send({
          embeds: [
            {
              title: `${member.user.username} just joined! 🎉`,
              description,
              color: 0x00ff00,
              thumbnail: { url: member.user.displayAvatarURL() ?? undefined },
              timestamp: new Date().toISOString(),
            },
          ],
        });
      } catch (err) {
        this.logger.error('Error handling GuildMemberAdd:', err);
      }
    });
  }

  private registerGuildMemberRemoveHandler(): void {
    this.client.on(Events.GuildMemberRemove, async (member: GuildMember) => {
      try {
        const serverId = member.guild.id;
        const serverName = member.guild.name;
        const serverConfig = await this.serversService.findOrCreateServer(
          serverId,
          serverName,
        );
        const welcomeChannelId = serverConfig?.welcomeChannelId;
        if (!welcomeChannelId) return;

        const channel = member.guild.channels.cache.get(welcomeChannelId);
        if (!channel || !(channel instanceof TextChannel)) return;

        await channel.send({
          embeds: [
            {
              title: `${member.user.username} just left the server! 👋`,
              description:
                "We're sorry to see you go.\\nWe hope you enjoyed your stay.\\n\\nIf you ever want to come back, we'll be here waiting for you.\\n\\nUntil then, take care! 🍪🤖🎉",
              color: 0xff0000,
              thumbnail: { url: member.user.displayAvatarURL() ?? undefined },
              timestamp: new Date().toISOString(),
            },
          ],
        });
      } catch (err) {
        this.logger.error('Error handling GuildMemberRemove:', err);
      }
    });
  }

  private isSendableChannel(
    channel: unknown,
  ): channel is TextChannel | NewsChannel | ThreadChannel | DMChannel {
    return (
      channel instanceof TextChannel ||
      channel instanceof NewsChannel ||
      channel instanceof ThreadChannel ||
      channel instanceof DMChannel
    );
  }

  private startCacheCleanupInterval(): void {
    // Clean up old conversation contexts every 5 minutes
    setInterval(
      () => {
        const now = Date.now();
        let removedCount = 0;
        for (const [key, context] of this.conversationContextCache.entries()) {
          if (
            now - context.lastBotReplyTimestamp >
            this.CONVERSATION_TIMEOUT_MS
          ) {
            this.conversationContextCache.delete(key);
            removedCount++;
          }
        }
        if (removedCount > 0) {
          this.logger.debug(
            `[Cache Cleanup] Removed ${removedCount} expired conversation contexts`,
          );
        }
        // Clean up old rate limit entries
        let rateLimitRemoved = 0;
        for (const [userId, timestamps] of this.userRateLimits.entries()) {
          const validTimestamps = timestamps.filter(
            (ts) => now - ts < this.RATE_LIMIT_WINDOW_MS,
          );
          if (validTimestamps.length === 0) {
            this.userRateLimits.delete(userId);
            rateLimitRemoved++;
          } else if (validTimestamps.length !== timestamps.length) {
            this.userRateLimits.set(userId, validTimestamps);
          }
        }
        if (rateLimitRemoved > 0) {
          this.logger.debug(
            `[Cache Cleanup] Removed ${rateLimitRemoved} expired rate limit entries`,
          );
        }
      },
      5 * 60 * 1000,
    ); // Every 5 minutes
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userTimestamps = this.userRateLimits.get(userId) || [];
    const recentTimestamps = userTimestamps.filter(
      (ts) => now - ts < this.RATE_LIMIT_WINDOW_MS,
    );
    if (recentTimestamps.length >= this.MAX_REQUESTS_PER_WINDOW) {
      return false;
    }
    recentTimestamps.push(now);
    this.userRateLimits.set(userId, recentTimestamps);
    return true;
  }

  private isMessageBeingProcessed(messageId: string): boolean {
    return this.processingMessages.has(messageId);
  }

  private markMessageAsProcessing(messageId: string): void {
    this.processingMessages.add(messageId);
  }

  private markMessageAsProcessed(messageId: string): void {
    this.processingMessages.delete(messageId);
  }

  private async handleGptResponse(
    message: Message,
    user: UserModel,
    gptQuestion: string,
  ) {
    if (this.isSendableChannel(message.channel)) {
      await message.channel.sendTyping();
    }
    this.logger.log(
      `[GPT] Incoming question from ${message.author.username}: "${gptQuestion}"`,
    );
    const cacheKey = `${message.channel.id}-${message.author.id}`;
    const cached = this.conversationContextCache.get(cacheKey);
    let priorConversationId = cached?.conversationId;
    try {
      // Load persisted per-channel conversation if not cached
      if (!priorConversationId && message.guild) {
        priorConversationId =
          await this.serversService.getChannelConversationId(
            message.guild.id,
            message.channel.id,
          );
      }
    } catch (e) {
      this.logger.warn(
        `Failed to load channel conversation for ${message.guild?.id}/${message.channel.id}: ${(e as Error).message}`,
      );
    }

    let historyText = '';
    if (this.isSendableChannel(message.channel)) {
      try {
        const history = await message.channel.messages.fetch({
          limit: 15,
          before: message.id,
        });
        historyText = history
          .reverse()
          .map((m) => {
            let content = m.content;
            const imageCount = m.attachments.filter((a) =>
              a.contentType?.startsWith('image/'),
            ).size;
            if (imageCount > 0) {
              content += ` [attached ${imageCount} image${imageCount > 1 ? 's' : ''}]`;
            }
            return `User ${m.author.username} (ID: ${m.author.id}): ${content}`;
          })
          .join('\n');
      } catch (e) {
        this.logger.warn(
          `Failed to fetch message history for channel ${message.channel.id}: ${(e as Error).message}`,
        );
      }
    }

    const fullQuestion = `Here is the recent conversation history in this channel. Your response should continue the conversation naturally as a participant named NeverBot.\n\n${historyText}\n\nUser ${message.author.username} (ID: ${message.author.id}): ${gptQuestion}`;

    // Extract image attachments if any
    const imageUrls: string[] = [];
    if (message.attachments.size > 0) {
      for (const attachment of message.attachments.values()) {
        if (attachment.contentType?.startsWith('image/')) {
          imageUrls.push(attachment.url);
          this.logger.log(`[GPT] Image attachment detected: ${attachment.url}`);
        }
      }
    }

    let gptResponse: string | null = null;
    let conversationId: string | undefined = undefined;

    try {
      const response = await generateOpenAiReplyWithState(
        fullQuestion,
        message.author.globalName || message.author.username,
        user,
        this.userMessagesService,
        priorConversationId,
        imageUrls.length > 0 ? imageUrls : undefined,
      );
      gptResponse = response.content;
      conversationId = response.conversationId;
    } catch (gptError) {
      this.logger.error(
        `[GPT] Failed to generate response for ${message.author.username}: ${(gptError as Error).message}`,
        (gptError as Error).stack,
      );
    }

    if (gptResponse) {
      const maxDiscordMessageLength = 2000;
      let lastMessageInChannel: Message | undefined;
      if (this.isSendableChannel(message.channel)) {
        try {
          const messages = await message.channel.messages.fetch({ limit: 1 });
          lastMessageInChannel = messages.first();
        } catch (fetchError) {
          this.logger.warn(
            `Could not fetch last message in channel ${message.channel.id}: ${fetchError.message}`,
          );
        }
      }

      const sendDirectly =
        !lastMessageInChannel || lastMessageInChannel.id === message.id;
      let botReplyMessage: Message | undefined;

      if (gptResponse.length > maxDiscordMessageLength) {
        this.logger.debug(
          `[GPT] Response length ${gptResponse.length} exceeds limit. Splitting...`,
        );
        const responseParts = splitTextIntoParts(
          gptResponse,
          maxDiscordMessageLength,
        );
        for (let i = 0; i < responseParts.length; i++) {
          let currentPartReply: Message | undefined;
          if (
            i === 0 &&
            sendDirectly &&
            this.isSendableChannel(message.channel)
          ) {
            currentPartReply = await message.channel.send(responseParts[i]);
          } else if (i === 0 && !sendDirectly) {
            currentPartReply = await message.reply(responseParts[i]);
          } else if (this.isSendableChannel(message.channel)) {
            currentPartReply = await message.channel.send(responseParts[i]);
          } else {
            currentPartReply = await message.reply(responseParts[i]);
          }
          if (i === 0) botReplyMessage = currentPartReply; // Store the first part as the main bot reply
        }
      } else {
        if (sendDirectly && this.isSendableChannel(message.channel)) {
          botReplyMessage = await message.channel.send(gptResponse);
        } else {
          botReplyMessage = await message.reply(gptResponse);
        }
      }
      // Update conversation context cache
      if (botReplyMessage) {
        const newConversationId = conversationId ?? priorConversationId;
        this.conversationContextCache.set(cacheKey, {
          lastBotReplyTimestamp: Date.now(),
          lastBotMessageId: botReplyMessage.id,
          lastUserMessageId: message.id,
          conversationId: newConversationId,
        });
        // Persist per-channel conversation id for the guild
        if (newConversationId && message.guild) {
          try {
            await this.serversService.setChannelConversationId(
              message.guild.id,
              message.channel.id,
              newConversationId,
            );
            // Periodically prune stale entries
            await this.serversService.pruneStaleChannelConversations(
              message.guild.id,
              7 * 24 * 60 * 60 * 1000, // 7 days
              300, // keep most recent 300 channels per guild
            );
          } catch (e) {
            this.logger.warn(
              `Failed to persist channel conversation id: ${(e as Error).message}`,
            );
          }
        }
        this.logger.log(
          `[GPT] Replied to ${message.author.username}. Message ID: ${botReplyMessage.id}`,
        );
      }
    } else {
      const errorReplies = [
        'my brain just blue-screened. give me a sec and try again?',
        'took too long to think of something clever. ask me again?',
        'connection timed out on my end. hit me up again in a minute',
        'brain.exe has stopped responding. try that again?',
      ];
      const errorReply =
        errorReplies[Math.floor(Math.random() * errorReplies.length)];
      let botErrorReplyMessage: Message | undefined;
      if (this.isSendableChannel(message.channel)) {
        const messages = await message.channel.messages.fetch({ limit: 1 });
        const lastMessageInChannel = messages.first();
        if (!lastMessageInChannel || lastMessageInChannel.id === message.id) {
          botErrorReplyMessage = await message.channel.send(errorReply);
        } else {
          botErrorReplyMessage = await message.reply(errorReply);
        }
      } else {
        botErrorReplyMessage = await message.reply(errorReply);
      }
      // Even for an error, update context so we know bot responded
      if (botErrorReplyMessage) {
        this.conversationContextCache.set(cacheKey, {
          lastBotReplyTimestamp: Date.now(),
          lastBotMessageId: botErrorReplyMessage.id,
          lastUserMessageId: message.id,
          conversationId: cached?.conversationId,
        });
      }
      this.logger.warn('[GPT] No response generated; sent error fallback.');
    }
  }

  private registerMessageCreateHandler(): void {
    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot && message.author.id !== this.client.user?.id)
        return; // Allow bot's own messages for context later if needed
      if (message.author.id === this.client.user?.id) return; // Don't process bot's own messages as triggers

      if (!message.guild && !this.isSendableChannel(message.channel)) return; // Ignore DMs if not sendable, or non-guild without sendable
      if (!this.client.user) return;

      const discordUserId = message.author.id;
      const serverId = message.guild?.id; // Guild might be null for DMs if we handle them
      const serverName = message.guild?.name;
      const channelId = message.channel.id;
      const messageId = message.id;
      const messageContentLower = message.content.toLowerCase();
      const botNameLower = (
        this.client.user.username || 'MeanNever'
      ).toLowerCase();
      const alternativeBotNameLower = 'never';

      let user: UserModel;
      let serverConfig: Server | undefined = undefined;
      try {
        user = await this.usersService.findOrCreateUser(
          discordUserId,
          serverName,
          serverId,
        );
        if (serverId) {
          serverConfig = await this.serversService.findOrCreateServer(
            serverId,
            serverName,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error finding or creating user ${discordUserId} in server ${serverId}: ${error.message}`,
          error.stack,
        );
        return;
      }

      // Channel enablement check
      if (
        message.guild &&
        serverConfig &&
        Array.isArray(serverConfig.enabledChannels) &&
        serverConfig.enabledChannels.length > 0
      ) {
        if (!serverConfig.enabledChannels.includes(channelId)) {
          return; // Do not respond in this channel
        }
      }

      // Check if message is already being processed (prevent race conditions)
      if (this.isMessageBeingProcessed(messageId)) {
        this.logger.debug(
          `[Race Condition] Message ${messageId} is already being processed. Skipping.`,
        );
        return;
      }

      // Check rate limit
      const mentionsBotItself =
        messageContentLower.includes(botNameLower) ||
        message.mentions.has(this.client.user.id);
      const mentionsNever = messageContentLower.includes(
        alternativeBotNameLower,
      );
      const isBotMentioned = mentionsBotItself || mentionsNever;

      if (isBotMentioned && !this.checkRateLimit(discordUserId)) {
        this.logger.warn(
          `[Rate Limit] User ${message.author.username} (${discordUserId}) exceeded rate limit`,
        );
        try {
          await message.reply(
            'Whoa, slow down there champ. Give me a sec to breathe. Try again in a minute.',
          );
        } catch (e) {
          this.logger.warn(
            `Failed to send rate limit message: ${(e as Error).message}`,
          );
        }
        // Don't mark as processing since we're not processing it
        return;
      }

      // Mark message as being processed
      this.markMessageAsProcessing(messageId);

      // --- NLP and Message Saving Logic (NON-BLOCKING) ---
      // Process in background to avoid blocking response
      let sentimentScore: number;
      let sentimentComparative: number;
      let sentimentCategory: string;
      let significantTopics: string[] = [];
      let sentimentTokens: string[] = [];
      let wordsForMessageDto: string[] = [];

      try {
        const tokenizer = new natural.WordTokenizer();
        wordsForMessageDto = tokenizer.tokenize(message.content);
        const stemmer = natural.PorterStemmer;
        sentimentTokens = tokenizer.tokenize(messageContentLower);
        const sentimentAnalyzer = new natural.SentimentAnalyzer(
          'English',
          stemmer,
          'afinn',
        );
        const sentimentAnalysis =
          sentimentAnalyzer.getSentiment(sentimentTokens);
        sentimentScore = parseFloat(sentimentAnalysis.toFixed(4));
        sentimentComparative = sentimentScore;
        if (isNaN(sentimentScore)) {
          this.logger.warn(
            `Sentiment score was NaN for message ${messageId}. Defaulting to 0. Tokens: ${JSON.stringify(sentimentTokens)}`,
          );
          sentimentScore = 0; // Default to 0 if NaN
        }
        sentimentCategory = 'neutral';
        if (sentimentScore > 0.1) sentimentCategory = 'positive';
        else if (sentimentScore < -0.1) sentimentCategory = 'negative';
        const NGrams = natural.NGrams;
        const allTokensForTopics = tokenizer.tokenize(
          messageContentLower.replace(/[^a-zA-Z0-9\s]/g, ''),
        );
        const singleWords = allTokensForTopics
          .filter(
            (word) =>
              word.length >= 3 &&
              !natural.stopwords.includes(word.toLowerCase()),
          )
          .map((word) => stemmer.stem(word.toLowerCase()));
        const bigrams = NGrams.bigrams(allTokensForTopics)
          .filter(
            (bigram) =>
              bigram.length === 2 &&
              bigram.every(
                (word) =>
                  word.length >= 3 &&
                  !natural.stopwords.includes(word.toLowerCase()),
              ),
          )
          .map((bigram) =>
            bigram.map((word) => stemmer.stem(word.toLowerCase())).join('_'),
          );
        significantTopics = [...new Set([...singleWords, ...bigrams])].filter(
          Boolean,
        );
        if (significantTopics.length > 0) {
          const TfIdf = natural.TfIdf;
          const tfidf = new TfIdf();
          tfidf.addDocument(significantTopics.join(' '));
        }
      } catch (nlpError) {
        this.logger.error(
          `NLP processing error for message ${messageId} by user ${discordUserId}: ${nlpError.message}`,
          nlpError.stack,
        );
        sentimentScore = 0;
        sentimentComparative = 0;
        sentimentCategory = 'neutral';
        significantTopics = [];
      }
      // Save message and update user stats in background (non-blocking)
      void (async () => {
        try {
          // Use fallback content for image-only messages
          let messageContent = message.content;
          if (!messageContent || messageContent.trim() === '') {
            const imageCount = message.attachments.filter((a) =>
              a.contentType?.startsWith('image/'),
            ).size;
            messageContent = imageCount > 0 ? '[image]' : '[empty message]';
          }

          const createUserMessageDto: CreateUserMessageDto = {
            userId: discordUserId,
            messageId: messageId,
            channelId: channelId,
            guildId: serverId, // Use optional guildId
            content: messageContent,
            timestamp: message.createdAt,
            sentiment: {
              score: sentimentScore,
              comparative: sentimentComparative,
              tokens: sentimentTokens,
              words: wordsForMessageDto,
            },
            keywords: significantTopics,
          };
          await this.userMessagesService.create(createUserMessageDto);
        } catch (saveError) {
          this.logger.error(
            `Error saving message ${messageId} for user ${discordUserId} to DB: ${(saveError as Error).message}`,
            (saveError as Error).stack,
          );
        }
      })();

      // Update user stats in background (non-blocking)
      void (async () => {
        try {
          const currentSentiment = {
            sentiment: sentimentCategory,
            score: sentimentScore,
            timestamp: new Date(),
          };
          interface MongoUpdatePayload {
            $set: { lastSeen: Date };
            $inc: { messageCount: number };
            $push: {
              sentimentHistory: {
                $each: Array<{
                  sentiment: string;
                  score: number;
                  timestamp: Date;
                }>;
                $slice: number;
              };
            };
            $addToSet?: {
              topicsOfInterest: { $each: string[] };
            };
          }
          const updatePayload: MongoUpdatePayload = {
            $set: { lastSeen: new Date() },
            $inc: { messageCount: 1 },
            $push: {
              sentimentHistory: {
                $each: [currentSentiment],
                $slice: -100,
              },
            },
          };
          if (significantTopics.length > 0) {
            updatePayload.$addToSet = {
              topicsOfInterest: { $each: significantTopics },
            };
          }

          await this.usersService.updateUserByDiscordUserId(
            discordUserId,
            // @ts-expect-error - MongoDB update operators don't match UpdateUserDto
            updatePayload,
          );
        } catch (updateError) {
          this.logger.error(
            `Error updating user ${discordUserId} stats: ${(updateError as Error).message}`,
            (updateError as Error).stack,
          );
        }
      })();
      // --- End of NLP and Message Saving Logic ---
      const cacheKey = `${channelId}-${discordUserId}`;
      const cachedContext = this.conversationContextCache.get(cacheKey);
      let isFollowUp = false;

      if (
        cachedContext &&
        Date.now() - cachedContext.lastBotReplyTimestamp <
          this.CONVERSATION_TIMEOUT_MS
      ) {
        isFollowUp = true;
        this.logger.log(
          `Potential follow-up detected for ${discordUserId} in channel ${channelId}`,
        );
      }

      // Reaction logic (only if not a follow-up that will be replied to)
      if (isBotMentioned && !isFollowUp) {
        // If it's a follow up, we don't need the generic react.
        try {
          if (!message.content.endsWith('?')) {
            await message.react('🤔');
          }
        } catch (reactError) {
          const errorName = (reactError as Error).name || 'Unknown';
          const errorMsg = (reactError as Error).message || 'Unknown error';
          // Don't log permission errors at WARN level to reduce noise
          if (
            errorMsg.includes('Missing Permissions') ||
            errorMsg.includes('Missing Access')
          ) {
            this.logger.debug(
              `[Permissions] Cannot react to message ${message.id}: ${errorMsg}. Check bot permissions in this channel.`,
            );
          } else {
            this.logger.warn(
              `Failed to react to message ${message.id}: ${errorName} - ${errorMsg}`,
            );
          }
        }
      }

      // Core condition: bot is mentioned OR it's a follow-up to a recent bot interaction
      if (isBotMentioned || (isFollowUp && !isBotMentioned)) {
        this.logger.log(
          `Bot engaged by ${message.author.username} (Mention: ${isBotMentioned}, Follow-up: ${isFollowUp}): "${message.content}"`,
        );

        // Keywords to indicate user wants to stop the follow-up
        const stopKeywords = [
          'stop',
          "that's all",
          'im good',
          'nevermind',
          'nm',
          'cancel',
        ];
        const userWantsToStop =
          isFollowUp &&
          stopKeywords.some((keyword) => messageContentLower.includes(keyword));

        if (userWantsToStop) {
          this.logger.log(
            `User ${message.author.username} indicated to stop follow-up. Clearing context for ${cacheKey}`,
          );
          this.conversationContextCache.delete(cacheKey);
          // Send a brief acknowledgment
          const stopReplies = [
            'Okay!',
            'Sounds good.',
            'Alright, let me know if you need anything else!',
            'Gotcha.',
          ];
          const randomReply =
            stopReplies[Math.floor(Math.random() * stopReplies.length)];
          try {
            await message.reply(randomReply);
          } catch (e) {
            this.logger.warn(
              `Failed to send stop acknowledgement: ${(e as Error).message}`,
            );
          }
          // Mark as processed before returning
          this.markMessageAsProcessed(messageId);
          return; // End processing for this message
        }

        try {
          // Do not construct local follow-up history; rely on Responses conversation state.
          await this.handleGptResponse(message, user, message.content);
        } catch (replyError) {
          const errorMsg = (replyError as Error).message || 'Unknown error';
          const errorCode = (replyError as any)?.code;

          // Check if this is a permissions error
          if (
            errorMsg.includes('Missing Access') ||
            errorMsg.includes('Missing Permissions') ||
            errorCode === 50001 ||
            errorCode === 50013
          ) {
            this.logger.error(
              `[Permissions Error] Bot lacks permissions in channel ${channelId}: ${errorMsg}. Please grant VIEW_CHANNEL, SEND_MESSAGES, READ_MESSAGE_HISTORY, and ADD_REACTIONS permissions.`,
            );
          } else {
            this.logger.error(
              `Error in handleGptResponse for message ${message.id}: ${errorMsg}`,
              (replyError as Error).stack,
            );
            // Fallback error reply if handleGptResponse itself fails critically
            try {
              await message
                .reply('Something went very sideways. My apologies!')
                .catch((replyErr) =>
                  this.logger.error(
                    'Really failed to send error: ' +
                      (replyErr as Error).message,
                  ),
                );
            } catch {
              /* Already logged or intentionally ignored */
            }
          }
        } finally {
          // Always mark message as processed when done
          this.markMessageAsProcessed(messageId);
        }
      } else {
        // Not engaging with this message, mark as processed
        this.markMessageAsProcessed(messageId);
        if (cachedContext && !isFollowUp) {
          // Clear cache if the time has expired and it wasn't a follow-up attempt
          this.conversationContextCache.delete(cacheKey);
        }
      }
    });
  }

  private async handleError(interaction: CommandInteraction): Promise<void> {
    const replyOptions = {
      content: 'There was an error while executing this command!',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyOptions);
    } else {
      await interaction.reply(replyOptions);
    }
  }

  private async handleMessageReaction(
    reaction: MessageReaction,
    user: DiscordUserType,
  ): Promise<void> {
    try {
      if (reaction.partial) await reaction.fetch();
      const isTranslation = discordFlagToLanguageCode({
        emoji: reaction.emoji.name,
      });
      if (!isTranslation) return;

      const attachment = reaction.message.attachments.first();
      if (attachment && attachment.contentType?.startsWith('image/')) {
        const scrape = await textFromImage({
          imgLink: attachment.url,
          emoji: reaction.emoji.name,
          user,
        });
        if (scrape) await reaction.message.reply({ embeds: [scrape] });
      } else {
        const translation = await translateText(
          reaction.emoji.name,
          reaction.message.content,
          user,
        );
        if (translation)
          await reaction.message.reply({ embeds: [translation] });
      }
    } catch (error) {
      this.logger.error('Error handling message reaction:', error);
    }
  }

  private async setClientActivity(): Promise<void> {
    if (!this.client.user) return;
    await this.client.user.setActivity('/help', {
      type: ActivityType.Listening,
    });
  }

  private async loginClient(): Promise<void> {
    try {
      await this.client.login(this.token);
    } catch (error) {
      this.logger.error('Error logging in the Discord client:', error);
    }
  }

  // Optionally capture rate limit events for metrics or logging
  private registerRateLimitHandler(): void {
    interface ClientWithRest {
      rest?: {
        on?: (event: string, listener: (info: unknown) => void) => void;
      };
    }
    const clientWithRest = this.client as ClientWithRest;
    if (clientWithRest?.rest && typeof clientWithRest.rest.on === 'function') {
      clientWithRest.rest.on('rateLimited', (info: unknown) => {
        this.logger.warn(`[Discord] Rate limit hit: ${JSON.stringify(info)}`);
        try {
          discordRateLimitHits.inc();
        } catch {
          // Ignore metric errors
        }
      });
    }
  }
}
