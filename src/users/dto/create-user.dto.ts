import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  discordUserId: string;

  registeredAt: Date;
  serverName: string;
  serverId: string;
  subscription: string;
  tasks: any;
}
