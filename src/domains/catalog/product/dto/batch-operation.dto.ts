import {
  IsNotEmpty,
  IsArray,
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  ArrayMaxSize,
} from "class-validator";

export class BatchOperationDto {
  @IsNotEmpty()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMaxSize(50)
  productIds: string[]; // Maximum 50 items

  @IsNotEmpty()
  @IsEnum(["publish", "unpublish"])
  operation: "publish" | "unpublish";

  @IsOptional()
  @IsString()
  reason?: string; // Unpublish reason (optional when operation='unpublish')
}

export interface IBatchResult {
  success: number;
  failed: number;
  errors: Array<{
    productId: string;
    error: string;
  }>;
}

// Legacy alias for backward compatibility
export type BatchResult = IBatchResult;
