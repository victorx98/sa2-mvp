import { IsNotEmpty, IsUUID, IsInt, Min, IsOptional } from "class-validator";

export class AddServiceDto {
  @IsNotEmpty()
  @IsUUID()
  serviceId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
