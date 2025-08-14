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
    let serverDoc = (await this.serversModel
      .findOne({ discordServerId })
      .lean<Server>()
      .exec()) as any;
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

  async findOneByDiscordServerId(
    discordServerId: string,
  ): Promise<Server | null> {
    return this.serversModel
      .findOne({ discordServerId })
      .lean<Server>()
      .exec() as any;
  }
}
