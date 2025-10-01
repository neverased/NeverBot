import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Server } from './schemas/server.schema';

@Injectable()
export class ServersService {
  constructor(
    @InjectModel(Server.name) private readonly serversModel: Model<Server>,
  ) {}

  async findOrCreateServer(
    discordServerId: string,
    serverName?: string,
  ): Promise<Server> {
    let serverDoc = await this.serversModel
      .findOne({ discordServerId })
      .lean<Server>()
      .exec();
    if (!serverDoc) {
      serverDoc = await this.serversModel.create({
        discordServerId,
        serverName: serverName || 'N/A',
      });
    }
    return serverDoc;
  }

  async updateServerByDiscordServerId(
    discordServerId: string,
    update: Partial<Server>,
  ): Promise<Server | null> {
    return this.serversModel
      .findOneAndUpdate({ discordServerId }, { $set: update }, { new: true })
      .exec();
  }

  async getChannelConversationId(
    discordServerId: string,
    channelId: string,
  ): Promise<string | undefined> {
    const doc = await this.serversModel
      .findOne({ discordServerId })
      .lean<Server>()
      .exec();
    const map = doc?.channelConversations;
    return map?.[channelId];
  }

  async setChannelConversationId(
    discordServerId: string,
    channelId: string,
    conversationId: string,
  ): Promise<void> {
    const now = Date.now();
    await this.serversModel
      .updateOne(
        { discordServerId },
        {
          $set: {
            [`channelConversations.${channelId}`]: conversationId,
            [`channelConversationsUpdatedAt.${channelId}`]: now,
          },
        },
        { upsert: false },
      )
      .exec();
  }

  async pruneStaleChannelConversations(
    discordServerId: string,
    maxAgeMs: number,
    maxEntries: number = 200,
  ): Promise<void> {
    const doc = await this.serversModel
      .findOne({ discordServerId })
      .lean<Server>()
      .exec();
    if (!doc) return;
    const updated: Record<string, number> =
      doc.channelConversationsUpdatedAt || {};
    const entries = Object.entries(updated);
    // Remove stale by age
    const cutoff = Date.now() - maxAgeMs;
    const toDeleteByAge = entries
      .filter(([, ts]) => typeof ts === 'number' && ts < cutoff)
      .map(([ch]) => ch);
    const remaining = entries
      .filter(([, ts]) => typeof ts === 'number' && ts >= cutoff)
      .sort((a, b) => b[1] - a[1]);
    // Enforce maxEntries (keep most recent)
    const toDeleteByCount = remaining.slice(maxEntries).map(([ch]) => ch);
    const toDelete = Array.from(
      new Set([...toDeleteByAge, ...toDeleteByCount]),
    );
    if (toDelete.length === 0) return;
    const unset: Record<string, ''> = {};
    for (const ch of toDelete) {
      unset[`channelConversations.${ch}`] = '';
      unset[`channelConversationsUpdatedAt.${ch}`] = '';
    }
    await this.serversModel
      .updateOne({ discordServerId }, { $unset: unset }, { upsert: false })
      .exec();
  }

  async findOneByDiscordServerId(
    discordServerId: string,
  ): Promise<Server | null> {
    return this.serversModel.findOne({ discordServerId }).lean<Server>().exec();
  }
}
