import { IEvent } from "./event.types";

export const RESUME_BILLED_EVENT = "resume.billed";

export interface IResumeBilledPayload {
  /**
   * Unique identifier for the resume [简历的唯一标识符]
   */
  resumeId: string;

  /**
   * Unique identifier for the student [学生的唯一标识符]
   */
  studentId: string;

  /**
   * Unique identifier for the mentor [导师的唯一标识符]
   */
  mentorId: string;

  /**
   * Job title from the resume [简历中的职位名称]
   */
  jobTitle: string;

  /**
   * Description of the resume modification request [简历修改请求的描述]
   */
  description?: string;

  /**
   * Timestamp when the resume was billed [简历计费的时间戳]
   */
  billedAt: Date;
}

export interface IResumeBilledEvent extends IEvent<IResumeBilledPayload> {
  type: typeof RESUME_BILLED_EVENT;
}
