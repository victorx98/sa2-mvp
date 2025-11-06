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

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  meetingId: string; // Third-party meeting ID

  @IsOptional()
  @IsString()
  @MaxLength(20)
  meetingNo?: string; // Feishu meeting number (9 digits, Zoom does not have this)

  @IsUrl()
  @IsNotEmpty()
  meetingUrl: string; // Meeting link

  @IsOptional()
  @IsString()
  @MaxLength(50)
  meetingPassword?: string; // Meeting password (optional)
}
