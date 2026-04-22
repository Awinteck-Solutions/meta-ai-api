import { IsIn } from "class-validator";

export class InitializeSubscriptionDto {
  @IsIn(["starter", "growth", "business"])
  plan!: "starter" | "growth" | "business";
}
