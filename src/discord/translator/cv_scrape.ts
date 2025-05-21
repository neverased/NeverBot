import 'dotenv/config';

import vision from '@google-cloud/vision';
import axios from 'axios';
import { EmbedBuilder, User } from 'discord.js';
import { readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

import { justTranslateText } from './translate';

async function loadCredentials(): Promise<string> {
  const credentialsPath = path.join(
    __dirname,
    './sos-aio-bot-40e1568bd219.json',
  );
  return readFile(credentialsPath, 'utf8');
}

const visionClient = async () => {
  const credentials = await loadCredentials();
  return new vision.ImageAnnotatorClient({
    credentials: JSON.parse(credentials),
  });
};

const downloadImage = async (url: string, imagePath: string): Promise<void> => {
  const response = await axios({ url, responseType: 'arraybuffer' });
  await writeFile(imagePath, response.data);
};

export async function textFromImage({
  imgLink,
  emoji,
  user,
}: {
  imgLink: string;
  emoji: string;
  user: User;
}): Promise<EmbedBuilder> {
  const imagePath = path.join(__dirname, 'temp-image.png');
  await downloadImage(imgLink, imagePath);

  const client = await visionClient();
  const [result] = await client.textDetection(imagePath);
  const detections = result.textAnnotations ?? [];

  // Clean up the image file asynchronously without waiting for it to finish
  unlink(imagePath).catch((error) =>
    console.error('Failed to delete image:', error),
  );

  if (detections.length === 0) {
    throw new Error('No text detected in the image.');
  }

  const detectedText = detections[0]?.description ?? '';
  let translatedText = await justTranslateText(detectedText, emoji);

  const confidence = detections[0]?.confidence ?? 'N/A';

  if (!translatedText) {
    translatedText = 'Translation failed';
  }

  const embed = new EmbedBuilder()
    .setTitle('Image Translation Request')
    .setAuthor({
      name: `${user.username} requested translation to ${emoji}`,
      iconURL: user.avatarURL(),
    })
    .setColor('#0099ff')
    .setTimestamp()
    .setDescription(translatedText)
    .setFooter({
      text: `Scraping confidence right about now is at ${confidence}%`,
    });

  return embed;
}
