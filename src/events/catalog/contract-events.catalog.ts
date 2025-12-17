/**
 * Contract Events Catalog
 * 合同事件目录
 *
 * Centralized catalog for contract and class student related events.
 * These events handle contract lifecycle and class enrollment changes.
 *
 * 集中管理合同和班级学生相关事件的目录。
 * 这些事件处理合同生命周期和班级注册变更。
 */

import {
  EventCatalogEntry,
  EventDomain,
  EventType,
  ConsumerPriority,
  ErrorHandlingStrategy,
} from "./types";

import {
  CLASS_STUDENT_ADDED_EVENT,
  CLASS_STUDENT_REMOVED_EVENT,
} from "@shared/events/event-constants";

/**
 * Contract Events Catalog
 * Maps contract event name constants to their full metadata
 * 合同事件目录 - 将合同事件名称常量映射到完整元数据
 */
export const ContractEventsCatalog: Record<string, EventCatalogEntry> = {
  // ============================================================
  // Class Student Events (班级学生事件)
  // ============================================================

  [CLASS_STUDENT_ADDED_EVENT]: {
    name: CLASS_STUDENT_ADDED_EVENT,
    description:
      "Student added to a class. Updates class roster and triggers enrollment processing.",
    descriptionCN:
      "学生加入班级。更新班级名册并触发注册处理。",
    domain: EventDomain.CONTRACT,
    eventType: EventType.STATE_CHANGE,
    payloadType: "ClassStudentAddedEvent",
    producers: ["ClassService.addStudent", "ClassEnrollmentService"],
    consumers: [
      {
        handler: "ClassRosterUpdater",
        priority: ConsumerPriority.HIGH,
        async: false,
        module: "domains/services/class",
        description: "Update class roster with new student",
        errorStrategy: ErrorHandlingStrategy.FAIL_FAST,
      },
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify student and instructor of enrollment",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    tags: ["contract", "class", "enrollment", "student"],
    version: "1.0",
  },

  [CLASS_STUDENT_REMOVED_EVENT]: {
    name: CLASS_STUDENT_REMOVED_EVENT,
    description:
      "Student removed from a class. Updates class roster and may trigger refund processing.",
    descriptionCN:
      "学生从班级移除。更新班级名册并可能触发退款处理。",
    domain: EventDomain.CONTRACT,
    eventType: EventType.STATE_CHANGE,
    payloadType: "ClassStudentRemovedEvent",
    producers: ["ClassService.removeStudent", "ClassEnrollmentService"],
    consumers: [
      {
        handler: "ClassRosterUpdater",
        priority: ConsumerPriority.HIGH,
        async: false,
        module: "domains/services/class",
        description: "Remove student from class roster",
        errorStrategy: ErrorHandlingStrategy.FAIL_FAST,
      },
      {
        handler: "RefundProcessor",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "domains/financial",
        description: "Process refund if applicable",
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify student of removal from class",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    requires: [CLASS_STUDENT_ADDED_EVENT],
    tags: ["contract", "class", "enrollment", "student", "removal"],
    version: "1.0",
  },
};

/**
 * Get all contract event names
 * 获取所有合同事件名称
 */
export const getAllContractEventNames = (): string[] => {
  return Object.keys(ContractEventsCatalog);
};

/**
 * Check if event is a contract event
 * 检查事件是否为合同事件
 */
export const isContractEvent = (eventName: string): boolean => {
  return eventName in ContractEventsCatalog;
};
