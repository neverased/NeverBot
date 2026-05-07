import { buildWelcomePromptMessages } from './prompts';

describe('prompt builders', () => {
  it('builds a safe, short welcome prompt that mentions the new member', () => {
    const messages = buildWelcomePromptMessages('user-123', 'Alice');
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('not hostile');
    expect(messages[0]?.content).toContain('No slurs');
    expect(messages[1]).toEqual({
      role: 'user',
      content:
        'A new member joined. Welcome <@user-123> (username: Alice) in a short message.',
    });
  });
});
