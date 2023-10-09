export class CreateTaskDto {
  discord_server_id: string;
  discord_server_name: string;
  discord_channel_id: string;
  event_type: string;
  event_name: string;
  event_time_utc: Date;
  notification_start_date: Date;
  notification_interval: number;
}
