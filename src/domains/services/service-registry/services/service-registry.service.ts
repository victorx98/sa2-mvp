import { Injectable, Logger } from '@nestjs/common';
import { ServiceReferenceRepository } from '../service-reference.repository';
import { RegisterServiceDto } from '../dto/register-service.dto';
import { ServiceReferenceEntity } from '../entities/service-reference.entity';

/**
 * Service Registry Service
 * 
 * Manages service registration for billing and contract tracking
 */
@Injectable()
export class ServiceRegistryService {
  private readonly logger = new Logger(ServiceRegistryService.name);

  constructor(
    private readonly serviceReferenceRepository: ServiceReferenceRepository,
  ) {}

  /**
   * Register a completed service
   * Uses shared primary key to prevent duplicate billing
   */
  async registerService(dto: RegisterServiceDto): Promise<ServiceReferenceEntity> {
    this.logger.log(`Registering service: ${dto.service_type} (ID: ${dto.id})`);

    try {
      const serviceReference = await this.serviceReferenceRepository.create(dto);
      
      this.logger.log(
        `Successfully registered service ${dto.service_type} with ID ${dto.id}`,
      );

      return serviceReference;
    } catch (error) {
      this.logger.error(
        `Failed to register service ${dto.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

