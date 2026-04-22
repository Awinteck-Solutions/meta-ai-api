import { IsMongoId, IsOptional, IsString, IsNumber, Min } from "class-validator";

export class CreateBookingDto {
  @IsMongoId()
  customerId!: string;

  @IsMongoId()
  serviceId!: string;

  @IsString()
  bookingDate!: string;

  @IsString()
  bookingTime!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  paymentReference?: string;
}

export class UpdateBookingStatusDto {
  @IsString()
  status!: "pending" | "confirmed" | "paid" | "cancelled" | "completed";
}

