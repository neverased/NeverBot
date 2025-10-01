import { setCommands } from './discord/utils';

async function register(): Promise<void> {
  console.log('Attempting to register commands with Discord...');
  await setCommands();
  console.log('Command registration process finished.');
}

register().catch((error) => {
  console.error('Failed to register commands:', error);
  process.exit(1);
});
