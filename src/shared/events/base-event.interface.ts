import { v4 as uuidv4 } from 'uuid';

/**
 * Base interface for all domain events [基础事件接口]
 * 
 * This interface defines the common structure that all domain events should follow.
 * It provides essential metadata for event identification, tracking, and versioning.
 * [此接口定义了所有领域事件应遵循的通用结构，提供了事件标识、跟踪和版本控制的基本元数据]
 */
export interface IBaseEvent<TPayload = unknown> {
    /**
     * Unique identifier for the event instance [事件实例的唯一标识符]
     */
    readonly id: string;

    /**
     * Name of the event [事件名称]
     * Format: domain.entity.action (e.g., services.session.completed) [格式：领域.实体.动作]
     */
    readonly eventName: string;

    /**
     * Event payload containing the event data [事件载荷，包含事件数据]
     */
    readonly payload: TPayload;

    /**
     * Timestamp when the event was created [事件创建时间戳]
     */
    readonly timestamp: Date;

    /**
     * Source information about the event [事件来源信息]
     */
    readonly source: {
        /**
         * Domain of the event [事件所属域]
         */
        domain: string;

        /**
         * Service name that generated the event [生成事件的服务名称]
         */
        service: string;
    };

    /**
     * Event structure version number [事件结构版本号]
     * Follows semantic versioning (semver) [遵循语义化版本控制规范]
     */
    readonly version: string;
}

/**
 * Abstract base class for all domain events [所有领域事件的抽象基类]
 * 
 * This class provides a common implementation for creating domain events
 * with proper initialization of required properties.
 * [此类提供了创建领域事件的通用实现，正确初始化所需属性]
 */
export abstract class BaseEvent<TPayload = unknown> implements IBaseEvent<TPayload> {
    public readonly id: string;
    public readonly timestamp: Date;
    public readonly version: string;

    /**
     * Creates a new BaseEvent instance [创建新的基础事件实例]
     * 
     * @param eventName The name of the event [事件名称]
     * @param payload The event payload [事件载荷]
     * @param source The source information [来源信息]
     * @param version The event structure version [事件结构版本]
     */
    constructor(
        public readonly eventName: string,
        public readonly payload: TPayload,
        public readonly source: { domain: string; service: string },
        version?: string
    ) {
        this.id = uuidv4();
        this.timestamp = new Date();
        this.version = version || process.env.EVENT_VERSION || '1.0.0';
    }
}