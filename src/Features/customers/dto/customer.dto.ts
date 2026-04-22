import { IsEmail, IsOptional, IsString } from "class-validator";

export class UpsertCustomerDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

