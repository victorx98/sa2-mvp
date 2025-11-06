import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { IUserRepository, USER_REPOSITORY } from '@domains/identity/user/user-repository.interface';
import { RegisterDto } from '@api/dto/request/register.dto';
import { LoginDto } from '@api/dto/request/login.dto';
import { AuthResultDto } from '@application/use-cases/auth/dto/auth-result.dto';
import { RegisterUseCase } from '@application/use-cases/auth/register.use-case';
import { LoginUseCase } from '@application/use-cases/auth/login.use-case';

/**
 * Application Layer - Auth Command Service (兼容层)
 * 职责：为了保持向后兼容，委托给新的 UseCases
 *
 * 注意：这是临时兼容层，新代码应该直接使用 RegisterUseCase 和 LoginUseCase
 */
@Injectable()
export class AuthCommandService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResultDto> {
    return this.registerUseCase.execute(registerDto);
  }

  async login(loginDto: LoginDto): Promise<AuthResultDto> {
    return this.loginUseCase.execute(loginDto);
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
