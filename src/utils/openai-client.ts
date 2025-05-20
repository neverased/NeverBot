import 'dotenv/config';
import OpenAI from 'openai';

if (!process.env.GPT_KEY) {
  throw new Error('GPT_KEY environment variable is not set.');
}

const openai = new OpenAI({
  apiKey: process.env.GPT_KEY,
});

export default openai;
