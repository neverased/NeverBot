import { PartialType } from '@nestjs/mapped-types';

import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  registeredAt: Date;
  serverName: string;
  serverId: string;
  subscription: string;
  tasks: any;
}
