// Imports the Google Cloud client library
import 'dotenv/config';

import { Translate } from '@google-cloud/translate/build/src/v2';
import { EmbedBuilder } from 'discord.js';
import * as fs from 'fs';

let translateClient: Translate | null = null;
let translateCredentialsWarningLogged = false;

function getTranslateClient(): Translate | null {
  if (translateClient) {
    return translateClient;
  }

  const credentialsPath =
    process.env.GOOGLE_CLOUD_CREDENTIALS_PATH ||
    './sos-aio-bot-40e1568bd219.json';

  try {
    const data = fs.readFileSync(credentialsPath, {
      encoding: 'utf8',
      flag: 'r',
    });
    translateClient = new Translate({ credentials: JSON.parse(data) });
    return translateClient;
  } catch (error) {
    if (!translateCredentialsWarningLogged) {
      console.warn(
        `Google Translate credentials could not be loaded from ${credentialsPath}. Translation features will be disabled.`,
        error,
      );
      translateCredentialsWarningLogged = true;
    }
    return null;
  }
}

interface FlagToLanguageCodeParams {
  emoji: string;
}

// Maps Discord flag emoji to language codes
export function discordFlagToLanguageCode({
  emoji,
}: FlagToLanguageCodeParams): string | null {
  // Mapping of flag emoji to country codes
  const flagToCountry: Record<string, string> = {
    '🇺🇸': 'US',
    '🇬🇧': 'GB',
    '🇫🇷': 'FR',
    '🇩🇪': 'DE',
    '🇯🇵': 'JP',
    '🇨🇳': 'CN',
    '🇰🇷': 'KR',
    '🇮🇹': 'IT',
    '🇪🇸': 'ES',
    '🇷🇺': 'RU',
    '🇳🇱': 'NL',
    '🇸🇪': 'SE',
    '🇵🇱': 'PL',
    '🇧🇷': 'BR',
    '🇹🇷': 'TR',
    '🇺🇦': 'UA',
    '🇷🇴': 'RO',
    '🇬🇷': 'GR',
    '🇨🇿': 'CZ',
    '🇵🇹': 'PT',
    '🇭🇺': 'HU',
    '🇩🇰': 'DK',
    '🇫🇮': 'FI',
    '🇳🇴': 'NO',
    '🇮🇪': 'IE',
    '🇨🇭': 'CH',
    '🇦🇹': 'AT',
    '🇧🇪': 'BE',
    '🇧🇬': 'BG',
    '🇭🇷': 'HR',
    //hindi as requested
    '🇮🇳': 'HI',
    // Add more flag-to-country mappings as needed
  };

  const countryToLanguage: Record<string, string> = {
    US: 'en',
    GB: 'en',
    FR: 'fr',
    DE: 'de',
    JP: 'ja',
    CN: 'zh-CN',
    KR: 'ko',
    IT: 'it',
    ES: 'es',
    RU: 'ru',
    NL: 'nl',
    SE: 'sv',
    PL: 'pl',
    BR: 'pt-BR',
    TR: 'tr',
    UA: 'uk',
    RO: 'ro',
    GR: 'el',
    CZ: 'cs',
    PT: 'pt-PT',
    HU: 'hu',
    DK: 'da',
    FI: 'fi',
    NO: 'no',
    IE: 'ga',
    CH: 'de',
    AT: 'de',
    BE: 'nl',
    BG: 'bg',
    HR: 'hr',
    //hindi as requested
    HI: 'hi',
    // Add more country-to-language mappings as needed
  };

  const countryCode = flagToCountry[emoji];
  return countryCode ? countryToLanguage[countryCode] : null;
}

// Translates text without creating an embed
export async function justTranslateText(
  text: string,
  emoji: string,
): Promise<string | null> {
  try {
    const target = discordFlagToLanguageCode({ emoji });
    if (target == null) return null;
    const translate = getTranslateClient();
    if (!translate) return null;
    const [translations] = await translate.translate(text, target);
    return translations;
  } catch (error) {
    console.error('Error translating text:', error);
    return null;
  }
}

// Translates text and creates a Discord embed
export async function translateText(
  emoji: string,
  text: string,
  user: { username: string; avatarURL: () => string },
): Promise<EmbedBuilder | null> {
  try {
    const target = discordFlagToLanguageCode({ emoji });
    if (target == null) return null;
    const translate = getTranslateClient();
    if (!translate) return null;
    const [translations] = await translate.translate(text, target);

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${user.username} requested translation to ${emoji}`,
        iconURL: user.avatarURL(),
      })
      .setDescription(translations)
      .setColor('#0099ff')
      .setTimestamp();

    return embed;
  } catch (error) {
    console.error('Error creating translation embed:', error);
    return null;
  }
}
