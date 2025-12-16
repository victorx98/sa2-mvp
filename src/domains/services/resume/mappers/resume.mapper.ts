import { Resume } from '@infrastructure/database/schema';
import { ResumeDetail } from '../entities/resume.entity';

export class ResumeMapper {
  static toDetail(resume: Resume): ResumeDetail {
    return {
      id: resume.id,
      studentUserId: resume.studentUserId,
      jobTitle: resume.jobTitle,
      sessionType: resume.sessionType,
      fileName: resume.fileName,
      fileUrl: resume.fileUrl,
      status: resume.status as 'uploaded' | 'final' | 'deleted',
      finalSetAt: resume.finalSetAt ?? undefined,
      mentorUserId: resume.mentorUserId ?? undefined,
      billedAt: resume.billedAt ?? undefined,
      uploadedBy: resume.uploadedBy,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
    };
  }

  static toDetails(resumes: Resume[]): ResumeDetail[] {
    return resumes.map((resume) => this.toDetail(resume));
  }
}

