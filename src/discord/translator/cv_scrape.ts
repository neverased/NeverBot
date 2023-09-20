import 'dotenv/config';
import fs from 'fs';
const { Translate } = require('@google-cloud/translate').v2;
import { EmbedBuilder } from 'discord.js';
import vision from '@google-cloud/vision';
import { justTranslateText } from './translate';

const data = fs.readFileSync('./sos-aio-bot-40e1568bd219.json', {
  encoding: 'utf8',
  flag: 'r',
});

// Creates a client
const client = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(data),
});

const translate = new Translate({
  credentials: JSON.parse(data),
});

import axios from 'axios';

/* ============================================================
  Function: Download Image
============================================================ */

const download_image = (url, image_path) =>
  axios({
    url,
    responseType: 'stream',
  }).then(
    (response) =>
      new Promise<void>((resolve, reject) => {
        response.data
          .pipe(fs.createWriteStream(image_path))
          .on('finish', () => resolve())
          .on('error', (e) => reject(e));
      }),
  );

export async function textFromImage({
  imgLink,
  emoji,
  user,
}: {
  imgLink: string;
  emoji: string;
  user: any;
}): Promise<EmbedBuilder> {
  await download_image(imgLink, 'example-1.png');

  const [result] = await client.textDetection('example-1.png');

  const detections = result.textAnnotations;

  //console.log('Text: ' + detections[0].description);

  //delete image
  fs.unlinkSync('example-1.png');

  let translatedText = await justTranslateText(
    detections[0].description, //text to translate
    emoji, //flag emoji
  );

  const confidence = detections[0].confidence;

  if (translatedText == null) {
    translatedText = 'Translation failed';
  }

  //console.log('Translated Text: ' + translatedText);

  const embed = new EmbedBuilder()
    .setTitle('Image Translation Request')
    .setAuthor({
      name: user.username + ' requested translation to ' + emoji + '',
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
// Performs text detection on the local file
