import { IsEmail, IsString } from "class-validator";

export class CreateContactDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  subject!: string;

  @IsString()
  message!: string;
}
