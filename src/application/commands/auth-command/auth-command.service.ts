import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "@domains/identity/user/user-repository.interface";
import { RegisterDto } from "@api/dto/request/register.dto";
import { LoginDto } from "@api/dto/request/login.dto";
import { AuthResponseDto } from "@api/dto/response/auth-response.dto";

@Injectable()
export class AuthCommandService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUserByEmail = await this.userRepository.findByEmail(
      registerDto.email,
    );
    if (existingUserByEmail) {
      throw new ConflictException("Email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = await this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
    });

    // Generate JWT token
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        cnNickname: user.cnNickname,
        status: user.status,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Find user with password
    const user = await this.userRepository.findByEmailWithPassword(
      loginDto.email,
    );
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if user is active
    if (user.status && user.status !== "active") {
      throw new UnauthorizedException("User account is not active");
    }

    // Generate JWT token
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        cnNickname: user.cnNickname,
        status: user.status,
      },
    };
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user;
  }
}
