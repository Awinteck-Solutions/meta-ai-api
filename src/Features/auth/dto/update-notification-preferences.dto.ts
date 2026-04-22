import { IsBoolean, IsOptional } from "class-validator";

/** PATCH /users/notification-preferences — public API uses short keys; persisted as notification* on User. */
export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  weekly?: boolean;
}
