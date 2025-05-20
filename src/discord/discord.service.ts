import 'dotenv/config';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ActivityType,
  Client,
  Collection,
  CommandInteraction,
  ChatInputCommandInteraction,
  Events,
  GatewayIntentBits,
  Interaction,
  Message,
  MessageReaction,
  Partials,
  User as DiscordUserType,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  DMChannel,
} from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as natural from 'natural';
import OpenAI from 'openai';

import { UsersService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { User as UserModel } from '../users/entities/user.entity';
import { UserMessagesService } from '../users/messages/messages.service';
import { CreateUserMessageDto } from '../users/messages/dto/create-user-message.dto';

import { textFromImage } from './translator/cv_scrape';
import { translateText } from './translator/translate';
import { discordFlagToLanguageCode } from './translator/translate';
import { generateOpenAiReply, splitTextIntoParts } from './gpt/gpt-logic';

interface Command {
  data: { name: string; description?: string };
  execute: (
    interaction: ChatInputCommandInteraction,
    userProfile?: UserModel,
    userMessagesService?: UserMessagesService,
    usersService?: UsersService,
  ) => Promise<void>;
}

// Define a type for our conversation context cache
interface ConversationContext {
  lastBotReplyTimestamp: number;
  lastBotMessageId?: string; // Optional: to fetch bot's own last message for context
  lastUserMessageId: string; // The user message that the bot last replied to or was a follow-up to
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
  ) {
    this.validateToken();
    this.client = this.initializeClient();
    this.client.commands = new Collection<string, Command>();
    this.loadCommands();
  }

  private validateToken(): void {
    if (!this.token) {
      this.logger.error('BOT_TOKEN environment variable is not set.');
      throw new Error('BOT_TOKEN environment variable is not set.');
    }
  }

  private initializeClient(): Client {
    return new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
      partials: [
        Partials.Reaction,
        Partials.Message,
        Partials.User,
        Partials.Channel,
        Partials.GuildMember,
      ],
    });
  }

  private async loadCommands(): Promise<void> {
    const foldersPath = path.join(__dirname, 'commands');
    try {
      await fs.access(foldersPath);
    } catch (error) {
      this.logger.warn(`Commands folder not found at path: ${foldersPath}`);
      return;
    }

    const commandFolders = await fs.readdir(foldersPath);

    for (const folder of commandFolders) {
      const commandsPath = path.join(foldersPath, folder);
      const commandFiles = (await fs.readdir(commandsPath)).filter((file) =>
        file.endsWith('.js'),
      );

      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command: Command = await import(filePath);
        if (command.data && command.execute) {
          this.client.commands.set(command.data.name, command);
        } else {
          this.logger.warn(
            `The command at ${filePath} is missing a required "data" or "execute" property.`,
          );
        }
      }
    }
  }

  async onModuleInit(): Promise<void> {
    this.registerInteractionCreateHandler();
    this.registerClientReadyHandler();
    this.registerMessageReactionAddHandler();
    this.registerMessageCreateHandler();
    await this.loginClient();
  }

  private registerInteractionCreateHandler(): void {
    this.client.on(
      Events.InteractionCreate,
      async (interaction: Interaction) => {
        if (!interaction.isChatInputCommand()) {
          if (interaction.isCommand() && !interaction.isChatInputCommand()) {
            this.logger.warn(
              `Received non-chat input command: ${interaction.commandName}`,
            );
          }
          return;
        }
        const command = this.client.commands.get(interaction.commandName);

        if (!command) {
          this.logger.error(
            `No command matching ${interaction.commandName} was found.`,
          );
          return;
        }

        try {
          let userProfile: UserModel | undefined = undefined;
          if (interaction.user) {
            try {
              userProfile = await this.usersService.findOrCreateUser(
                interaction.user.id,
                interaction.guild?.name,
                interaction.guild?.id,
              );
            } catch (err) {
              this.logger.error(
                `Error fetching user profile for ${interaction.user.id}:`,
                err,
              );
            }
          }
          await command.execute(
            interaction,
            userProfile,
            this.userMessagesService,
            this.usersService,
          );
        } catch (error) {
          this.logger.error(
            `Error executing command ${interaction.commandName}:`,
            error,
          );
          await this.handleError(interaction);
        }
      },
    );
  }

  private registerClientReadyHandler(): void {
    this.client.on(Events.ClientReady, () => {
      this.logger.log('Client is ready!');
      this.setClientActivity();
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
    conversationHistory?: Array<OpenAI.Chat.ChatCompletionMessageParam>,
  ) {
    if (this.isSendableChannel(message.channel)) {
      await message.channel.sendTyping();
    }

    const gptResponse = await generateOpenAiReply(
      gptQuestion,
      message.author.globalName || message.author.username,
      user,
      this.userMessagesService,
      conversationHistory,
    );

    const cacheKey = `${message.channel.id}-${message.author.id}`;

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
        this.conversationContextCache.set(cacheKey, {
          lastBotReplyTimestamp: Date.now(),
          lastBotMessageId: botReplyMessage.id,
          lastUserMessageId: message.id,
        });
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
        });
      }
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
      try {
        user = await this.usersService.findOrCreateUser(
          discordUserId,
          serverName,
          serverId,
        );
      } catch (error) {
        this.logger.error(
          `Error finding or creating user ${discordUserId} in server ${serverId}: ${error.message}`,
          error.stack,
        );
        return;
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
        try {
          let currentConversationHistory: Array<OpenAI.Chat.ChatCompletionMessageParam> =
            [];
          if (
            isFollowUp &&
            cachedContext &&
            this.isSendableChannel(message.channel)
          ) {
            try {
              const fetchedMessages = await message.channel.messages.fetch({
                limit: 12,
                before: message.id,
              });
              // Convert collection to array, filter, then reverse
              const relevantMessages = Array.from(fetchedMessages.values())
                .filter(
                  (m) =>
                    m.author.id === message.author.id ||
                    m.author.id === this.client.user?.id,
                )
                .reverse();

              for (const msg of relevantMessages) {
                currentConversationHistory.push({
                  role:
                    msg.author.id === this.client.user?.id
                      ? 'assistant'
                      : 'user',
                  content: msg.content,
                });
              }
              this.logger.log(
                `Constructed follow-up history with ${currentConversationHistory.length} messages.`,
              );
            } catch (fetchError) {
              this.logger.warn(
                `Could not fetch message history for follow-up context: ${fetchError.message}`,
              );
            }
          }
          await this.handleGptResponse(
            message,
            user,
            message.content,
            currentConversationHistory,
          );
        } catch (replyError) {
          this.logger.error(
            `Error in handleGptResponse for message ${message.id}: ${replyError.message}`,
            replyError.stack,
          );
          // Fallback error reply if handleGptResponse itself fails critically
          try {
            await message
              .reply('Something went very sideways. My apologies!')
              .catch((e) =>
                this.logger.error('Really failed to send error: ' + e.message),
              );
          } catch (e) {
            /* Already logged */
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
}
