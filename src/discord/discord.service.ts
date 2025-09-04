import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ActivityType,
  ChatInputCommandInteraction,
  Client,
  Collection,
  CommandInteraction,
  DMChannel,
  Events,
  GatewayIntentBits,
  Interaction,
  Message,
  MessageReaction,
  NewsChannel,
  Partials,
  TextChannel,
  ThreadChannel,
  GuildMember,
  User as DiscordUserType,
} from 'discord.js';
import * as fs from 'fs/promises';
import * as natural from 'natural';
import OpenAI from 'openai';
import * as path from 'path';

import { User as UserModel } from '../users/entities/user.entity';
import { CreateUserMessageDto } from '../users/messages/dto/create-user-message.dto';
import { UserMessagesService } from '../users/messages/messages.service';
import { UsersService } from '../users/users.service';
import { ServersService } from '../servers/servers.service';
import {
  generateOpenAiReplyWithState,
  splitTextIntoParts,
} from './gpt/gpt-logic';
import { textFromImage } from './translator/cv_scrape';
import { translateText } from './translator/translate';
import { discordFlagToLanguageCode } from './translator/translate';
import { callChatCompletion } from '../shared/openai/chat';
import { DiscordClientProvider } from './discord-client.provider';
import { CommandRegistry } from './command-registry';
import { InteractionHandler } from './interaction-handler';
import { discordRateLimitHits } from '../core/metrics/metrics-registry';
import { WikiSearchService } from '../wikis/wikisearch.service';

interface Command {
  data: { name: string; description?: string };
  execute: (
    interaction: ChatInputCommandInteraction,
    userProfile?: UserModel,
    userMessagesService?: UserMessagesService,
    usersService?: UsersService,
    serversService?: ServersService,
    wikiSearchService?: WikiSearchService,
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

  constructor(
    private readonly usersService: UsersService,
    private readonly userMessagesService: UserMessagesService,
    private readonly serversService: ServersService,
    private readonly wikiSearchService: WikiSearchService,
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
                'You are MeanNever, a chatbot that answers questions with sarcastic or very funny responses. Every new sentence will be in a new line with \\n prefix.',
            },
            {
              role: 'user',
              content: `Welcome ${member.user.username} to the server!`,
            },
            {
              role: 'assistant',
              content: `Hold onto your keyboard, folks! 🎉 \\nWe've got a fresh face in town! \\nWelcome, ${member.user.username} 🌟, the chosen one who dared to click 'Join'. \\nPrepare for a wild ride of laughs, discussions, and the occasional virtual dance-off.\\nDon't worry, our emojis are friendly, and our GIFs are well-trained.\\nIf you're lost, just shout 'HELP' and our tech wizards will come to your rescue.`,
            },
            {
              role: 'user',
              content: `Give a warm welcome to @${member.user.username} \\nIntroduce yourself in a short sentence and mention that '/help' is the command to get started.`,
            },
          ],
          { model: 'gpt-5', temperature: 1, maxCompletionTokens: 200 },
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
    channel: any,
  ): channel is TextChannel | NewsChannel | ThreadChannel | DMChannel {
    return (
      channel instanceof TextChannel ||
      channel instanceof NewsChannel ||
      channel instanceof ThreadChannel ||
      channel instanceof DMChannel
    );
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
          .map(
            (m) =>
              `User ${m.author.username} (ID: ${m.author.id}): ${m.content}`,
          )
          .join('\n');
      } catch (e) {
        this.logger.warn(
          `Failed to fetch message history for channel ${message.channel.id}: ${(e as Error).message}`,
        );
      }
    }

    const fullQuestion = `Here is the recent conversation history in this channel. Your response should continue the conversation naturally as a participant named NeverBot.\n\n${historyText}\n\nUser ${message.author.username} (ID: ${message.author.id}): ${gptQuestion}`;

    const { content: gptResponse, conversationId } =
      await generateOpenAiReplyWithState(
        fullQuestion,
        message.author.globalName || message.author.username,
        user,
        this.userMessagesService,
        this.wikiSearchService,
        priorConversationId,
      );

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
      const errorReply =
        'I tried to think of something witty, but my circuits are fried. Ask again later?';
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
      let serverConfig: any = undefined;
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

      // --- NLP and Message Saving Logic (existing, ensure it runs for all user messages) ---
      // ... (This part remains, ensure it executes before response logic)
      let sentimentScore: number;
      let sentimentAnalysis: any;
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
        sentimentAnalysis = sentimentAnalyzer.getSentiment(sentimentTokens);
        sentimentScore = parseFloat(sentimentAnalysis.toFixed(4));
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
        sentimentAnalysis = { score: 0, comparative: 0, tokens: [], words: [] };
        sentimentCategory = 'neutral';
        significantTopics = [];
      }
      try {
        const createUserMessageDto: CreateUserMessageDto = {
          userId: discordUserId,
          messageId: messageId,
          channelId: channelId,
          guildId: serverId, // Use optional guildId
          content: message.content,
          timestamp: message.createdAt,
          sentiment: {
            score: sentimentScore,
            comparative:
              sentimentAnalysis.comparative === undefined
                ? sentimentScore
                : sentimentAnalysis.comparative,
            tokens: sentimentTokens,
            words: wordsForMessageDto,
          },
          keywords: significantTopics,
        };
        await this.userMessagesService.create(createUserMessageDto);
      } catch (saveError) {
        this.logger.error(
          `Error saving message ${messageId} for user ${discordUserId} to DB: ${saveError.message}`,
          saveError.stack,
        );
      }
      const currentSentiment = {
        sentiment: sentimentCategory,
        score: sentimentScore,
        timestamp: new Date(),
      };
      const updatePayload: any = {
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
        updatePayload,
      );
      // --- End of NLP and Message Saving Logic ---

      const mentionsBotItself =
        messageContentLower.includes(botNameLower) ||
        message.mentions.has(this.client.user.id);
      const mentionsNever = messageContentLower.includes(
        alternativeBotNameLower,
      );
      const isBotMentioned = mentionsBotItself || mentionsNever;
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
          this.logger.warn(
            `Failed to react to message ${message.id}: ${reactError.message}`,
          );
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
              `Failed to send stop acknowledgement: ${e.message}`,
            );
          }
          return; // End processing for this message
        }

        try {
          // Do not construct local follow-up history; rely on Responses conversation state.
          await this.handleGptResponse(message, user, message.content);
        } catch (replyError) {
          this.logger.error(
            `Error in handleGptResponse for message ${message.id}: ${replyError.message}`,
            replyError.stack,
          );
          // Fallback error reply if handleGptResponse itself fails critically
          try {
            await message
              .reply('Something went very sideways. My apologies!')
              .catch((replyError) =>
                this.logger.error(
                  'Really failed to send error: ' + replyError.message,
                ),
              );
          } catch {
            /* Already logged or intentionally ignored */
          }
        }
      } else if (cachedContext && !isFollowUp) {
        // Clear cache if the time has expired and it wasn't a follow-up attempt
        this.conversationContextCache.delete(cacheKey);
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
    const anyClient = this.client as any;
    if (anyClient?.rest && typeof anyClient.rest.on === 'function') {
      anyClient.rest.on('rateLimited', (info: unknown) => {
        this.logger.warn(`[Discord] Rate limit hit: ${JSON.stringify(info)}`);
        try {
          discordRateLimitHits.inc();
        } catch {}
      });
    }
  }
}
