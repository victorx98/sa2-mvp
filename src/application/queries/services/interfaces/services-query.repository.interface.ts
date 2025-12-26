/**
 * Services Query Repository Interfaces
 * 服务查询仓储接口集合
 * 
 * This file contains all service-related query repository interfaces
 * to maintain consistency across the services domain
 */
import { IPaginatedResult } from '@shared/types/paginated-result';

// ============ DI Tokens ============
export const CLASS_QUERY_REPOSITORY = Symbol('CLASS_QUERY_REPOSITORY');
export const CLASS_SESSION_QUERY_REPOSITORY = Symbol('CLASS_SESSION_QUERY_REPOSITORY');
export const COMM_SESSION_QUERY_REPOSITORY = Symbol('COMM_SESSION_QUERY_REPOSITORY');
export const REGULAR_MENTORING_QUERY_REPOSITORY = Symbol('REGULAR_MENTORING_QUERY_REPOSITORY');
export const SESSION_TYPE_QUERY_REPOSITORY = Symbol('SESSION_TYPE_QUERY_REPOSITORY');
export const RECOMM_LETTER_TYPE_QUERY_REPOSITORY = Symbol('RECOMM_LETTER_TYPE_QUERY_REPOSITORY');

// ============ Read Models (simplified, actual models should be in separate files) ============
export interface ClassReadModel {
  id: string;
  name: string;
  code: string;
  status: string;
  type: string;
  mentors?: any[];
  counselors?: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassSessionReadModel {
  id: string;
  classId: string;
  title: string;
  status: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Note: Actual implementation should have separate model files for each entity
// This is a simplified version for quick refactoring

// ============ Repository Interfaces ============
export interface IClassQueryRepository {
  getAllClassesWithMembers(params?: any): Promise<IPaginatedResult<ClassReadModel>>;
  getClassMentorsWithNames(classId: string): Promise<any[]>;
  getClassCounselorsWithNames(classId: string): Promise<any[]>;
}

export interface IClassSessionQueryRepository {
  findByFilters(params: any): Promise<IPaginatedResult<ClassSessionReadModel>>;
}

export interface ICommSessionQueryRepository {
  findByFilters(params: any): Promise<IPaginatedResult<any>>;
}

export interface IRegularMentoringQueryRepository {
  findByFilters(params: any): Promise<IPaginatedResult<any>>;
}

export interface ISessionTypeQueryRepository {
  findAll(): Promise<any[]>;
}

export interface IRecommLetterTypeQueryRepository {
  findAll(): Promise<any[]>;
}

