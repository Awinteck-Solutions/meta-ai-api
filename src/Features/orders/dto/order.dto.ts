import { IsArray, IsMongoId, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateOrderItemDto {
  @IsMongoId()
  catalogItemId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsMongoId()
  customerId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  paymentReference?: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  status!: "pending" | "paid" | "cancelled" | "completed";
}

