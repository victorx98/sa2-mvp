import { IEvent } from "./event.types";

export const CLASS_STUDENT_ADDED_EVENT = "class.student.added";

export interface IClassStudentAddedPayload {
  /**
   * Unique identifier for the class [班级的唯一标识符]
   */
  classId: string;

  /**
   * Name of the class [班级名称]
   */
  name: string;

  /**
   * Type of the class [班级类型]
   */
  type: string;

  /**
   * Status of the class [班级状态]
   */
  status: string;

  /**
   * Start date of the class [班级开始日期]
   */
  startDate: Date;

  /**
   * End date of the class [班级结束日期]
   */
  endDate: Date;

  /**
   * Description of the class [班级描述]
   */
  description?: string;

  /**
   * Unique identifier for the student [学生的唯一标识符]
   */
  studentId: string;

  /**
   * Timestamp when the student was added [学生加入的时间戳]
   */
  operatedAt: Date;

  /**
   * Quantity of class entitlements to deduct (default: 1) [扣除的班级权益数量(默认值: 1)]
   */
  deductionQuantity?: number;
}

export interface IClassStudentAddedEvent
  extends IEvent<IClassStudentAddedPayload> {
  type: typeof CLASS_STUDENT_ADDED_EVENT;
}
