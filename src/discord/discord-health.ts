export const DISCORD_HEALTH = Symbol('DISCORD_HEALTH');

export interface DiscordHealth {
  isReady(): boolean;
}
