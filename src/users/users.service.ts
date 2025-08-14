import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, mongo } from 'mongoose';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/users.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly usersModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    if (!createUserDto.discordUserId) {
      throw new Error('discordUserId is required to create a user.');
    }
    const createdUser = new this.usersModel(createUserDto);

    console.log(createdUser, 'createdUser');
    return createdUser.save();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.usersModel.find().lean<UserDocument[]>({}).exec() as any;
  }

  async findOneByDiscordUserId(
    discordUserId: string,
  ): Promise<UserDocument | null> {
    return this.usersModel
      .findOne({ discordUserId: discordUserId })
      .lean<UserDocument>({})
      .exec() as any;
  }

  async findOrCreateUser(
    discordUserId: string,
    serverName?: string,
    serverId?: string,
  ): Promise<UserDocument> {
    let userDoc: UserDocument | null = await this.usersModel
      .findOne({ discordUserId })
      .exec();
    if (!userDoc) {
      const createUserDto: CreateUserDto = {
        discordUserId,
        serverName: serverName || 'N/A',
        serverId: serverId || 'N/A',
        registeredAt: new Date(),
        subscription: 'free',
        tasks: {},
      };
      userDoc = await this.create(createUserDto);
    }
    return userDoc;
  }

  async updateUserByDiscordUserId(
    discordUserId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument | null> {
    return this.usersModel
      .findOneAndUpdate({ discordUserId: discordUserId }, updateUserDto, {
        new: true,
      })
      .exec();
  }

  async update(
    serverId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument | null> {
    return this.usersModel
      .findOneAndUpdate(
        { serverId: serverId },
        { $set: updateUserDto },
        { new: true },
      )
      .exec();
  }

  async removeByDiscordUserId(
    discordUserId: string,
  ): Promise<mongo.DeleteResult> {
    const result = await this.usersModel
      .deleteOne({ discordUserId: discordUserId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `User with Discord ID #${discordUserId} not found for deletion`,
      );
    }
    return result;
  }

  async remove(serverId: string): Promise<mongo.DeleteResult> {
    return await this.usersModel.deleteOne({ serverId: serverId }).exec();
  }

  async updatePersonalitySummary(
    discordUserId: string,
    summary: string,
  ): Promise<UserDocument | null> {
    return this.usersModel
      .findOneAndUpdate(
        { discordUserId },
        {
          $set: { personalitySummary: summary, lastSeen: new Date() },
          $inc: { __v: 1 },
        },
        { new: true },
      )
      .exec();
  }

  async findActiveUsersForSummaryUpdate(
    sinceDays: number = 7,
  ): Promise<UserDocument[]> {
    const dateSince = new Date();
    dateSince.setDate(dateSince.getDate() - sinceDays);
    return this.usersModel
      .find({
        lastSeen: { $gte: dateSince },
        messageCount: { $gt: 0 },
      })
      .exec();
  }
}
