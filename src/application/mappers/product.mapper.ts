import { Injectable } from '@nestjs/common';
import { DtoMapperBase } from '../core/dto.mapper.base';
import { CreateProductDto } from '@domains/catalog/product/dto/create-product.dto';
import { UpdateProductDto } from '@domains/catalog/product/dto/update-product.dto';
import type { Product } from '@infrastructure/database/schema';

/**
 * Product Mapper
 * [产品映射器]
 * 
 * 职责：
 * 1. 将Product实体转换为Product DTO
 * 2. 将CreateProductDto转换为Product实体
 * 3. 将UpdateProductDto转换为Product实体更新对象
 */
@Injectable()
export class ProductMapper extends DtoMapperBase {
  /**
   * 将Product实体转换为Product DTO
   * [Map Product entity to Product DTO]
   * 
   * @param entity Product实体
   * @returns Product DTO
   */
  mapToDto<T, U>(entity: T): U {
    const productEntity = entity as unknown as Product;
    return {
      id: productEntity.id,
      name: productEntity.name,
      code: productEntity.code,
      description: productEntity.description,
      coverImage: productEntity.coverImage,
      targetUserPersonas: productEntity.targetUserPersona as any,
      price: productEntity.price,
      currency: productEntity.currency as any,
      marketingLabels: productEntity.marketingLabels as any,
      status: productEntity.status as any,
      publishedAt: productEntity.publishedAt,
      unpublishedAt: productEntity.unpublishedAt,
      metadata: productEntity.metadata as any,
      createdAt: productEntity.createdAt,
      updatedAt: productEntity.updatedAt,
      createdBy: productEntity.createdBy,
    } as unknown as U;
  }

  /**
   * 将CreateProductDto转换为Product实体
   * [Map CreateProductDto to Product entity]
   * 
   * @param dto CreateProductDto
   * @returns Product实体
   */
  mapToEntity<T, U>(dto: T): U {
    const createDto = dto as unknown as CreateProductDto;
    return {
      name: createDto.name,
      code: createDto.code,
      description: createDto.description,
      coverImage: createDto.coverImage,
      targetUserPersona: createDto.targetUserPersonas,
      price: createDto.price.toString(),
      currency: createDto.currency,
      marketingLabels: createDto.marketingLabels,
      metadata: createDto.metadata,
    } as unknown as U;
  }

  /**
   * 将UpdateProductDto转换为Product实体更新对象
   * [Map UpdateProductDto to Product entity update]
   * 
   * @param dto UpdateProductDto
   * @returns Product实体更新对象
   */
  mapToUpdateEntity<T, U>(dto: T): U {
    const updateDto = dto as unknown as UpdateProductDto;
    const updateData: Partial<Product> = {};

    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
    }

    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description;
    }

    if (updateDto.coverImage !== undefined) {
      updateData.coverImage = updateDto.coverImage;
    }

    if (updateDto.targetUserPersonas !== undefined) {
      updateData.targetUserPersona = updateDto.targetUserPersonas;
    }

    if (updateDto.price !== undefined) {
      updateData.price = updateDto.price.toString();
    }

    if (updateDto.currency !== undefined) {
      updateData.currency = updateDto.currency;
    }

    if (updateDto.marketingLabels !== undefined) {
      updateData.marketingLabels = updateDto.marketingLabels;
    }

    if (updateDto.metadata !== undefined) {
      updateData.metadata = updateDto.metadata;
    }

    return updateData as unknown as U;
  }
}
