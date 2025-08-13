import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WikiPageDocument = HydratedDocument<WikiPage>;

/**
 * Represents a full wiki page document.
 */
@Schema({ timestamps: true, collection: 'wiki_pages' })
export class WikiPage {
  @Prop({ required: true, index: true })
  url!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: [Number], default: [] })
  embedding!: number[];

  @Prop({ type: [String], default: [] })
  headings!: string[];

  @Prop({ default: null })
  lastCrawledAt?: Date | null;
}

export const WikiPageSchema = SchemaFactory.createForClass(WikiPage);
