import { IsString } from "class-validator";

export class SendMessageDto {
  @IsString()
  customerPhone!: string;

  @IsString()
  text!: string;
}
