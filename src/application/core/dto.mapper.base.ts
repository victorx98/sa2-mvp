import { Logger } from '@nestjs/common';

/**
 * DTO Mapper Base Class
 * [DTO映射器基类]
 * 
 * 提供实体与DTO之间转换的基础功能，包括：
 * 1. 日志记录
 * 2. 转换方法模板
 * 
 * Usage:
 * ```typescript
export class ProductMapper extends DtoMapperBase {
  mapToDto(entity: Product): ProductDto {
    return {
      id: entity.id,
      name: entity.name,
      code: entity.code,
      // 其他属性映射
    };
  }

  mapToEntity(dto: CreateProductDto): Product {
    return {
      name: dto.name,
      code: dto.code,
      // 其他属性映射
    };
  }
}
 * ```
 */
export abstract class DtoMapperBase {
  protected readonly logger: Logger;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * 将实体转换为DTO
   * [Map entity to DTO]
   * 
   * @param entity 实体对象
   * @returns DTO对象
   */
  abstract mapToDto<T, U>(entity: T): U;

  /**
   * 将DTO转换为实体
   * [Map DTO to entity]
   * 
   * @param dto DTO对象
   * @returns 实体对象
   */
  abstract mapToEntity<T, U>(dto: T): U;

  /**
   * 将实体列表转换为DTO列表
   * [Map entity list to DTO list]
   * 
   * @param entities 实体列表
   * @returns DTO列表
   */
  mapToDtoList<T, U>(entities: T[]): U[] {
    this.logger.debug(`Mapping ${entities.length} entities to DTOs`);
    return entities.map(entity => this.mapToDto<T, U>(entity));
  }

  /**
   * 将DTO列表转换为实体列表
   * [Map DTO list to entity list]
   * 
   * @param dtos DTO列表
   * @returns 实体列表
   */
  mapToEntityList<T, U>(dtos: T[]): U[] {
    this.logger.debug(`Mapping ${dtos.length} DTOs to entities`);
    return dtos.map(dto => this.mapToEntity<T, U>(dto));
  }
}
