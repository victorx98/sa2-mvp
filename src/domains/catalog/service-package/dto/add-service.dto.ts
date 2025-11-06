import {
  IsNotEmpty,
  IsUUID,
  IsInt,
  IsEnum,
  Min,
  IsOptional,
} from "class-validator";
import { ServiceUnit } from "../../common/interfaces/enums";

export class AddServiceDto {
  @IsNotEmpty()
  @IsUUID()
  serviceId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;

  @IsNotEmpty()
  @IsEnum(ServiceUnit)
  unit: ServiceUnit;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
