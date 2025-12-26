/**
 * Identity Query Repository Interfaces
 * 身份查询仓储接口集合（学生、导师、顾问、学校、专业）
 */
import { IPaginatedResult } from '@shared/types/paginated-result';

// ============ DI Tokens ============
export const STUDENT_QUERY_REPOSITORY = Symbol('STUDENT_QUERY_REPOSITORY');
export const MENTOR_QUERY_REPOSITORY = Symbol('MENTOR_QUERY_REPOSITORY');
export const COUNSELOR_QUERY_REPOSITORY = Symbol('COUNSELOR_QUERY_REPOSITORY');
export const SCHOOL_QUERY_REPOSITORY = Symbol('SCHOOL_QUERY_REPOSITORY');
export const MAJOR_QUERY_REPOSITORY = Symbol('MAJOR_QUERY_REPOSITORY');

// ============ Repository Interfaces ============
export interface IStudentQueryRepository {
  listStudents(params: any): Promise<IPaginatedResult<any>>;
  listOfCounselorView(counselorId?: string, search?: string, page?: number, pageSize?: number, studentId?: string): Promise<IPaginatedResult<any>>;
  getStudentProfile(studentId: string): Promise<any>;
}

export interface IMentorQueryRepository {
  listMentors(params: any): Promise<IPaginatedResult<any>>;
  getMentorProfile(mentorId: string): Promise<any>;
}

export interface ICounselorQueryRepository {
  listCounselors(params: any): Promise<IPaginatedResult<any>>;
}

export interface ISchoolQueryRepository {
  listSchools(params: any): Promise<IPaginatedResult<any>>;
}

export interface IMajorQueryRepository {
  listMajors(params: any): Promise<IPaginatedResult<any>>;
}

