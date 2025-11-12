import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUrl,
} from "class-validator";
import { MeetingProvider } from "../interfaces/session.interface";

export class MeetingInfoDto {
  @IsEnum(MeetingProvider)
  meetingProvider: MeetingProvider; // Meeting platform

  @IsOptional()
  @IsString()
  @MaxLength(20)
  meetingNo?: string; // Feishu meeting number (9 digits) - key field for webhook association

  @IsUrl()
  @IsNotEmpty()
  meetingUrl: string; // Meeting link

  @IsOptional()
  @IsString()
  @MaxLength(50)
  meetingPassword?: string; // Meeting password (optional)
}
