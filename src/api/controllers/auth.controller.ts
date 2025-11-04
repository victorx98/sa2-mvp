import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthCommandService } from '@application/commands/auth-command/auth-command.service';
import { RegisterDto } from '@api/dto/request/register.dto';
import { LoginDto } from '@api/dto/request/login.dto';
import { AuthResponseDto } from '@api/dto/response/auth-response.dto';
import { Public } from '@shared/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authCommandService: AuthCommandService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authCommandService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authCommandService.login(loginDto);
  }
}
