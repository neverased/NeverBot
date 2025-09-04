import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type WikiChunkDocument = HydratedDocument<WikiChunk>;

@Schema({ timestamps: true, collection: 'wiki_chunks' })
export class WikiChunk {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WikiPage', index: true })
  pageId!: string;

  @Prop({ required: true, index: true })
  url!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: [Number], default: [] })
  embedding!: number[];

  @Prop({ default: 0 })
  order!: number;
}

export const WikiChunkSchema = SchemaFactory.createForClass(WikiChunk);
WikiChunkSchema.index({ url: 1 });
WikiChunkSchema.index({ pageId: 1, order: 1 });
