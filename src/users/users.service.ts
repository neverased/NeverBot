import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly usersModel: Model<User>,
  ) {}

  create(createUserDto: CreateUserDto): Promise<User> {
    const createdUser = new this.usersModel(createUserDto);

    console.log(createdUser, 'createdUser');
    return createdUser.save();
  }

  findAll() {
    return this.usersModel.find().exec();
  }

  async findOne(serverId: string) {
    const server = await this.usersModel.findOne({ serverId: serverId }).exec();
    if (!server) {
      throw new NotFoundException(`Server #${serverId} not found`);
    }
    return server;
  }

  async update(serverId: string, updateUserDto: UpdateUserDto) {
    const existingUser = await this.usersModel
      .findOneAndUpdate(
        { serverId: serverId },
        { $set: updateUserDto },
        { new: true },
      )
      .exec();

    if (!existingUser) {
      throw new NotFoundException(`Server #${serverId} not found`);
    }
    return existingUser;
  }

  async remove(serverId: string) {
    return await this.usersModel.deleteOne({ serverId: serverId }).exec();
  }
}
