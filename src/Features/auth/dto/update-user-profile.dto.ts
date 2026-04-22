import { IsBoolean, IsOptional, IsString } from "class-validator";

/** PATCH /users/update-user — all fields optional. */
export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  firstname?: string;

  @IsOptional()
  @IsString()
  lastname?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  notificationEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationPush?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationWeekly?: boolean;
}
