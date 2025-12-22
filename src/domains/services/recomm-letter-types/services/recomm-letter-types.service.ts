import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { IRecommLetterTypesRepository, RECOMM_LETTER_TYPES_REPOSITORY } from '../repositories/recomm-letter-types.repository.interface';
import type { RecommLetterTypeEntity } from '../entities/recomm-letter-type.entity';

/**
 * Tree Node Structure for Response
 */
export interface RecommLetterTypeTreeNode {
  id: string;
  typeCode: string;
  typeName: string;
  serviceTypeCode: string;
  parentId: string | null;
  active: boolean;
  children: RecommLetterTypeTreeNode[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Recommendation Letter Types Service
 * 
 * Business logic for recommendation letter types management
 */
@Injectable()
export class RecommLetterTypesService {
  constructor(
    @Inject(RECOMM_LETTER_TYPES_REPOSITORY)
    private readonly repository: IRecommLetterTypesRepository,
  ) {}

  /**
   * Get all recommendation letter types as tree structure
   */
  async getTypesTree(serviceTypeCode?: string): Promise<RecommLetterTypeTreeNode[]> {
    const allTypes = serviceTypeCode
      ? await this.repository.findByServiceTypeCode(serviceTypeCode)
      : await this.repository.findAll();
    return this.buildTree(allTypes);
  }

  /**
   * Create new recommendation letter type
   */
  async createType(data: {
    typeCode: string;
    typeName: string;
    serviceTypeCode: string;
    parentId?: string | null;
  }): Promise<RecommLetterTypeEntity> {
    // Check if type code already exists
    const existing = await this.repository.findByTypeCode(data.typeCode);
    if (existing) {
      throw new ConflictException(`Type code '${data.typeCode}' already exists`);
    }

    // Validate parent exists if provided
    if (data.parentId) {
      const parent = await this.repository.findById(data.parentId);
      if (!parent) {
        throw new NotFoundException(`Parent type with ID '${data.parentId}' not found`);
      }
    }

    return this.repository.create({
      typeCode: data.typeCode,
      typeName: data.typeName,
      serviceTypeCode: data.serviceTypeCode,
      parentId: data.parentId || null,
      active: true,
    });
  }

  /**
   * Find recommendation letter type by ID
   */
  async findById(id: string): Promise<RecommLetterTypeEntity | null> {
    return this.repository.findById(id);
  }

  /**
   * Delete recommendation letter type (cascade delete children)
   */
  async deleteType(id: string): Promise<void> {
    const type = await this.repository.findById(id);
    if (!type) {
      throw new NotFoundException(`Type with ID '${id}' not found`);
    }

    await this.repository.delete(id);
  }

  /**
   * Build tree structure from flat list
   */
  private buildTree(types: RecommLetterTypeEntity[]): RecommLetterTypeTreeNode[] {
    const map = new Map<string, RecommLetterTypeTreeNode>();
    const roots: RecommLetterTypeTreeNode[] = [];

    // Create nodes
    types.forEach(type => {
      map.set(type.id, {
        id: type.id,
        typeCode: type.typeCode,
        typeName: type.typeName,
        serviceTypeCode: type.serviceTypeCode,
        parentId: type.parentId,
        active: type.active,
        children: [],
        createdAt: type.createdAt,
        updatedAt: type.updatedAt,
      });
    });

    // Build tree
    map.forEach(node => {
      if (node.parentId) {
        const parent = map.get(node.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}

