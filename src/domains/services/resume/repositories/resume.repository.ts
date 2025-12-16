import { Inject, Injectable } from '@nestjs/common';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { resumes, type Resume, type NewResume } from '@infrastructure/database/schema';

@Injectable()
export class ResumeRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  // Create resume
  async create(data: NewResume): Promise<Resume> {
    const [resume] = await this.db.insert(resumes).values(data).returning();
    return resume;
  }

  // Find by ID
  async findById(id: string): Promise<Resume | null> {
    const [resume] = await this.db
      .select()
      .from(resumes)
      .where(eq(resumes.id, id))
      .limit(1);
    return resume ?? null;
  }

  // Find by student
  async findByStudent(studentUserId: string): Promise<Resume[]> {
    return this.db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.studentUserId, studentUserId),
          eq(resumes.status, 'uploaded')
        )
      )
      .orderBy(resumes.createdAt);
  }

  // Find all resumes (including all statuses) by student
  async findAllByStudent(studentUserId: string): Promise<Resume[]> {
    return this.db
      .select()
      .from(resumes)
      .where(eq(resumes.studentUserId, studentUserId))
      .orderBy(resumes.createdAt);
  }

  // Find final resume for a job title
  async findFinalByJobTitle(
    studentUserId: string,
    jobTitle: string,
  ): Promise<Resume | null> {
    const [resume] = await this.db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.studentUserId, studentUserId),
          eq(resumes.jobTitle, jobTitle),
          eq(resumes.status, 'final')
        )
      )
      .limit(1);
    return resume ?? null;
  }

  // Find billed resume for a job title
  async findBilledByJobTitle(
    studentUserId: string,
    jobTitle: string,
  ): Promise<Resume | null> {
    const [resume] = await this.db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.studentUserId, studentUserId),
          eq(resumes.jobTitle, jobTitle),
          isNotNull(resumes.mentorUserId)
        )
      )
      .limit(1);
    return resume ?? null;
  }

  // Update resume
  async update(id: string, data: Partial<NewResume>): Promise<Resume> {
    // Filter out undefined values, keep null for database NULL
    const updateData = Object.entries({ ...data, updatedAt: new Date() })
      .reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

    const [updated] = await this.db
      .update(resumes)
      .set(updateData)
      .where(eq(resumes.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Resume with id ${id} not found or update failed`);
    }
    
    return updated;
  }

  // Soft delete (update status to 'deleted')
  async softDelete(id: string): Promise<void> {
    await this.db
      .update(resumes)
      .set({
        status: 'deleted',
        updatedAt: new Date(),
      })
      .where(eq(resumes.id, id));
  }
}

