// Imports the Google Cloud client library
import 'dotenv/config';
import * as fs from 'fs';

const { Translate } = require('@google-cloud/translate').v2;
import { EmbedBuilder } from 'discord.js';

const data = fs.readFileSync('./sos-aio-bot-40e1568bd219.json', {
  encoding: 'utf8',
  flag: 'r',
});

// Creates a client
const translate = new Translate({
  credentials: JSON.parse(data),
});

export function discordFlagToLanguageCode({
  emoji,
}: {
  emoji: string;
}): string | null {
  const flagToCountry: { [key: string]: string } = {
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
    // Add more flag-to-country mappings as needed
  };

  const countryToLanguage: { [key: string]: string } = {
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
    // Add more country-to-language mappings as needed
  };

  if (emoji in flagToCountry) {
    const countryCode: string = flagToCountry[emoji];
    if (countryCode in countryToLanguage) {
      return countryToLanguage[countryCode];
    }
  }
  return null; // Return null if no mapping is found
}

export async function justTranslateText(
  text: string,
  emoji: string,
): Promise<string> {
  const target = discordFlagToLanguageCode({ emoji });
  if (target == null) return null;
  const [translations] = await translate.translate(text, target);
  return translations;
}

export async function translateText(
  emoji: string,
  text: string,
  user: any,
): Promise<EmbedBuilder> {
  const target = discordFlagToLanguageCode({ emoji });
  if (target == null) return null;
  const translations = await translate.translate(text, target);
  //console.log('Translations:');
  //console.log(translations);

  const embed = new EmbedBuilder()
    .setAuthor({
      name: user.username + ' requested translation to ' + emoji + '',
      iconURL: user.avatarURL(),
    })
    .setDescription(translations[0])
    .setColor('#0099ff')
    .setTimestamp();

  return embed;
}
