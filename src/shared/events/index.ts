/**
 * Event definitions module [事件定义模块]
 * 
 * This module exports all event-related interfaces and implementations
 * for consistent event handling across the application.
 * [此模块导出所有事件相关的接口和实现，用于应用程序中的一致事件处理]
 */

// Base event interfaces and classes [基础事件接口和类]
export { IBaseEvent, BaseEvent } from './base-event.interface';

// Service session completed event [服务会话完成事件]
export { 
    ServiceSessionCompletedEvent, 
    IServiceSessionCompletedEvent, 
    ServiceSessionCompletedPayload 
} from './service-session-completed.event';