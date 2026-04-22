import { IsString, MinLength } from "class-validator";

export class FinalizeWhatsappConnectDto {
  @IsString()
  @MinLength(20)
  state!: string;

  @IsString()
  @MinLength(10)
  code!: string;

  /** Must match the URL Meta used for the OAuth dialog (same origin as FRONTEND_URL, under /dashboard). */
  @IsString()
  @MinLength(8)
  redirectUri!: string;

  /** From Embedded Signup FINISH session event (`phone_number_id`). */
  @IsString()
  @MinLength(5)
  phoneNumberId!: string;
}
