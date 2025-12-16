import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ResumeRepository } from '../repositories/resume.repository';
import { ResumeMapper } from '../mappers/resume.mapper';
import { UploadResumeDto } from '../dto/upload-resume.dto';
import { ResumeDetail } from '../entities/resume.entity';

@Injectable()
export class ResumeService {
  constructor(
    private readonly resumeRepository: ResumeRepository,
  ) {}

  /**
   * Upload resume
   */
  async upload(dto: UploadResumeDto, userId: string): Promise<ResumeDetail> {
    // Validate S3 URL format
    if (!dto.fileUrl.startsWith('https://') && !dto.fileUrl.startsWith('s3://')) {
      throw new BadRequestException('INVALID_FILE_URL');
    }

    // Create resume
    const resume = await this.resumeRepository.create({
      studentUserId: dto.studentUserId,
      jobTitle: dto.jobTitle,
      sessionType: dto.sessionType || 'Resume',
      fileName: dto.fileName,
      fileUrl: dto.fileUrl,
      status: 'uploaded',
      uploadedBy: userId,
    });

    return ResumeMapper.toDetail(resume);
  }

  /**
   * List resumes by student (grouped by job title)
   */
  async listByStudent(studentUserId: string): Promise<Record<string, ResumeDetail[]>> {
    const resumes = await this.resumeRepository.findAllByStudent(studentUserId);
    const details = ResumeMapper.toDetails(resumes);

    // Group by job title
    const grouped: Record<string, ResumeDetail[]> = {};
    for (const detail of details) {
      if (!grouped[detail.jobTitle]) {
        grouped[detail.jobTitle] = [];
      }
      grouped[detail.jobTitle].push(detail);
    }

    return grouped;
  }

  /**
   * Set resume as final
   * - Auto-cancel previous final for same job title
   */
  async setFinal(resumeId: string, userId: string): Promise<ResumeDetail> {
    const resume = await this.resumeRepository.findById(resumeId);
    if (!resume) {
      throw new NotFoundException('RESUME_NOT_FOUND');
    }

    if (resume.status !== 'uploaded') {
      throw new BadRequestException('INVALID_STATUS');
    }

    // Check for existing final resume for same job title
    const existingFinal = await this.resumeRepository.findFinalByJobTitle(
      resume.studentUserId,
      resume.jobTitle,
    );

    // Cancel existing final if exists
    if (existingFinal) {
      await this.resumeRepository.update(existingFinal.id, {
        status: 'uploaded',
        finalSetAt: null,
      });
    }

    // Set new final
    const updated = await this.resumeRepository.update(resumeId, {
      status: 'final',
      finalSetAt: new Date(),
    });

    return ResumeMapper.toDetail(updated);
  }

  /**
   * Cancel final status
   */
  async cancelFinal(resumeId: string, userId: string): Promise<ResumeDetail> {
    const resume = await this.resumeRepository.findById(resumeId);
    if (!resume) {
      throw new NotFoundException('RESUME_NOT_FOUND');
    }

    if (resume.status !== 'final') {
      throw new BadRequestException('RESUME_NOT_FINAL');
    }

    const updated = await this.resumeRepository.update(resumeId, {
      status: 'uploaded',
      finalSetAt: null,
    });

    return ResumeMapper.toDetail(updated);
  }

  /**
   * Delete resume (soft delete)
   * - Cannot delete billed or final resumes
   */
  async delete(resumeId: string, userId: string): Promise<void> {
    const resume = await this.resumeRepository.findById(resumeId);
    if (!resume) {
      throw new NotFoundException('RESUME_NOT_FOUND');
    }

    // Check if billed
    if (resume.mentorUserId) {
      throw new BadRequestException('BILLED_RESUME_CANNOT_DELETE');
    }

    // Check if final
    if (resume.status === 'final') {
      throw new BadRequestException('FINAL_RESUME_CANNOT_DELETE');
    }

    await this.resumeRepository.softDelete(resumeId);
  }
}

