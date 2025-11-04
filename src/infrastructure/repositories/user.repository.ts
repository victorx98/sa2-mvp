import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { IUserRepository } from '@domains/identity/user/user-repository.interface';
import { User, UserWithPassword } from '@domains/identity/user/user.interface';
import { UserEntity } from '../database/entities/user.entity';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    return user ? this.mapToUser(user) : null;
  }

  async findByAccount(account: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { account } });
    return user ? this.mapToUser(user) : null;
  }

  async findByAccountWithPassword(account: string): Promise<UserWithPassword | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.account = :account', { account })
      .getOne();

    return user ? this.mapToUserWithPassword(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    return user ? this.mapToUser(user) : null;
  }

  async create(userData: Partial<UserWithPassword>): Promise<User> {
    const id = uuidv4().replace(/-/g, '').substring(0, 32);
    const user = this.userRepository.create({
      ...userData,
      id,
      status: userData.status || 'active',
    });

    const savedUser = await this.userRepository.save(user);
    return this.mapToUser(savedUser);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.userRepository.update(id, userData);
    const updatedUser = await this.userRepository.findOne({ where: { id } });
    return this.mapToUser(updatedUser);
  }

  private mapToUser(entity: UserEntity): User {
    return {
      id: entity.id,
      gender: entity.gender,
      nickname: entity.nickname,
      cnNickname: entity.cnNickname,
      status: entity.status,
      account: entity.account,
      email: entity.email,
      country: entity.country,
      createdTime: entity.createdTime,
      modifiedTime: entity.modifiedTime,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
    };
  }

  private mapToUserWithPassword(entity: UserEntity): UserWithPassword {
    return {
      ...this.mapToUser(entity),
      password: entity.password,
    };
  }
}
