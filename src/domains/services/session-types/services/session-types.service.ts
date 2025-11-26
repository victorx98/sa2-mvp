import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionTypesRepository } from '../session-types.repository';
import { SessionTypeEntity } from '../entities/session-type.entity';

/**
 * Session Types Service
 * 
 * Handles session type configuration management
 */
@Injectable()
export class SessionTypesService {
  constructor(
    private readonly sessionTypesRepository: SessionTypesRepository,
  ) {}

  async findOne(id: string): Promise<SessionTypeEntity> {
    const sessionType = await this.sessionTypesRepository.findOne(id);
    if (!sessionType) {
      throw new NotFoundException(`Session type with ID ${id} not found`);
    }
    return sessionType;
  }

  async findByCode(code: string): Promise<SessionTypeEntity[]> {
    return this.sessionTypesRepository.findByCode(code);
  }

  async findAll(): Promise<SessionTypeEntity[]> {
    return this.sessionTypesRepository.findAll();
  }
}

