import { callStructuredResponse } from '../../shared/openai/chat';
import { UserMessagesService } from '../messages/messages.service';
import { UsersService } from '../users.service';
import { PersonalityService } from './personality.service';

jest.mock('../../shared/openai/chat', () => ({
  callStructuredResponse: jest.fn(),
}));

const mockedCallStructuredResponse =
  callStructuredResponse as jest.MockedFunction<typeof callStructuredResponse>;

describe('PersonalityService', () => {
  let service: PersonalityService;
  let userMessagesService: jest.Mocked<Pick<UserMessagesService, 'findMessagesForPersonalityAnalysis'>>;
  let usersService: jest.Mocked<
    Pick<UsersService, 'findOneByDiscordUserId' | 'updateUserByDiscordUserId'>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    userMessagesService = {
      findMessagesForPersonalityAnalysis: jest.fn(),
    };
    usersService = {
      findOneByDiscordUserId: jest.fn(),
      updateUserByDiscordUserId: jest.fn(),
    };
    service = new PersonalityService(
      userMessagesService as unknown as UserMessagesService,
      usersService as unknown as UsersService,
    );
  });

  it('skips refresh until the user has enough collected messages', async () => {
    usersService.findOneByDiscordUserId.mockResolvedValue({
      discordUserId: 'user-1',
      messageCount: 4,
    } as never);

    const result = await service.maybeRefreshPersonalitySummary('user-1');

    expect(result.status).toBe('skipped');
    expect(mockedCallStructuredResponse).not.toHaveBeenCalled();
  });

  it('generates a structured personality summary from recent messages', async () => {
    usersService.findOneByDiscordUserId.mockResolvedValue({
      discordUserId: 'user-1',
      messageCount: 30,
      personalitySummaryMessageCount: 0,
      topicsOfInterest: ['typescript', 'debugging'],
      sentimentHistory: [
        { sentiment: 'neutral', score: 0.2, timestamp: new Date() },
        { sentiment: 'positive', score: 0.6, timestamp: new Date() },
      ],
    } as never);
    userMessagesService.findMessagesForPersonalityAnalysis.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        content:
          index === 11
            ? `I keep breaking TypeScript builds but I love debugging it. ${'x'.repeat(400)}`
            : `Message ${index + 1} about debugging bots and TypeScript edges.`,
        timestamp: new Date(`2026-05-07T${String(index).padStart(2, '0')}:00:00.000Z`),
        keywords: ['typescript', 'debug'],
      })) as never,
    );
    mockedCallStructuredResponse.mockResolvedValue({
      parsed: {
        summary:
          'Often jokes through technical frustration, especially around TypeScript and debugging.',
        styleHints: ['dry', 'technical', 'self-deprecating'],
        recurringTopics: ['typescript', 'debugging', 'crypto skepticism'],
        confidence: 'medium',
      },
      content: null,
      conversationId: 'resp_123',
    });

    const result = await service.maybeRefreshPersonalitySummary('user-1', {
      force: true,
    });

    expect(result.status).toBe('updated');
    expect(mockedCallStructuredResponse).toHaveBeenCalled();
    const promptMessages = mockedCallStructuredResponse.mock.calls[0][0];
    const userContent = String(promptMessages[1]?.content ?? '');
    expect(userContent).toContain('<user_profile>');
    expect(userContent).toContain('recent_topics: typescript, debugging');
    expect(userContent).toContain('Message sample count:');
    expect(userContent).not.toContain('x'.repeat(320));
    expect(usersService.updateUserByDiscordUserId).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        personalitySummary: expect.stringContaining('Often jokes'),
        personalitySummaryStatus: 'ready',
        personalitySummaryMessageCount: 30,
      }),
    );
  });

  it('marks generation errors without replacing the last good summary', async () => {
    usersService.findOneByDiscordUserId.mockResolvedValue({
      discordUserId: 'user-1',
      messageCount: 30,
      personalitySummary: 'Existing useful summary',
      personalitySummaryMessageCount: 0,
    } as never);
    userMessagesService.findMessagesForPersonalityAnalysis.mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => ({
        content: `hello from message ${index + 1}`,
        timestamp: new Date(`2026-05-07T${String(index).padStart(2, '0')}:00:00.000Z`),
      })) as never,
    );
    mockedCallStructuredResponse.mockRejectedValue(new Error('OpenAI down'));

    const result = await service.maybeRefreshPersonalitySummary('user-1', {
      force: true,
    });

    expect(result.status).toBe('error');
    expect(usersService.updateUserByDiscordUserId).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        personalitySummaryStatus: 'error',
        personalitySummaryError: 'OpenAI down',
      }),
    );
    expect(usersService.updateUserByDiscordUserId).not.toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        personalitySummary: expect.stringContaining('OpenAI down'),
      }),
    );
  });

  it('skips forced refresh when there is not enough usable recent evidence', async () => {
    usersService.findOneByDiscordUserId.mockResolvedValue({
      discordUserId: 'user-1',
      messageCount: 30,
      personalitySummaryMessageCount: 0,
    } as never);
    userMessagesService.findMessagesForPersonalityAnalysis.mockResolvedValue([
      {
        content: 'only one',
        timestamp: new Date('2026-05-07T10:00:00.000Z'),
      },
      {
        content: 'two',
        timestamp: new Date('2026-05-07T11:00:00.000Z'),
      },
    ] as never);

    const result = await service.maybeRefreshPersonalitySummary('user-1', {
      force: true,
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'not_enough_recent_messages',
    });
    expect(mockedCallStructuredResponse).not.toHaveBeenCalled();
    expect(usersService.updateUserByDiscordUserId).not.toHaveBeenCalled();
  });
});
