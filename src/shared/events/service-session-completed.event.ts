import { BaseEvent } from './base-event.interface';

/**
 * Payload interface for ServiceSessionCompleted event [服务会话完成事件的载荷接口]
 * 
 * This interface defines the data structure for the payload of a service session completed event.
 * It contains all the necessary information about the completed session.
 * [此接口定义了服务会话完成事件载荷的数据结构，包含已完成会话的所有必要信息]
 */
export interface ServiceSessionCompletedPayload {
    /**
     * Unique identifier for the session [会话的唯一标识符]
     */
    sessionId: string;

    /**
     * Unique identifier for the student [学生的唯一标识符]
     */
    studentId: string;

    /**
     * Unique identifier for the mentor [导师的唯一标识符]
     */
    mentorId: string;

    /**
     * Type of service provided [提供的服务类型]
     */
    serviceType: string;

    /**
     * Duration of the session in minutes [会话持续时间（分钟）]
     */
    duration: number;

    /**
     * Status of the session [会话状态]
     */
    status: string;
}

/**
 * Interface for ServiceSessionCompleted event [服务会话完成事件接口]
 * 
 * This interface extends the base event interface with the specific payload
 * for the service session completed event.
 * [此接口扩展了基础事件接口，包含服务会话完成事件的特定载荷]
 */
export interface IServiceSessionCompletedEvent {
    /**
     * Unique identifier for the event instance [事件实例的唯一标识符]
     */
    readonly id: string;

    /**
     * Name of the event [事件名称]
     */
    readonly eventName: string;

    /**
     * Event payload containing the session data [包含会话数据的事件载荷]
     */
    readonly payload: ServiceSessionCompletedPayload;

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
 * Implementation of ServiceSessionCompleted event [服务会话完成事件的实现]
 * 
 * This class represents a domain event that is published when a service session is completed.
 * It extends the BaseEvent class with the specific payload for service session completion.
 * [此类表示在服务会话完成时发布的领域事件，扩展了基础事件类，包含服务会话完成的特定载荷]
 */
export class ServiceSessionCompletedEvent extends BaseEvent<ServiceSessionCompletedPayload> implements IServiceSessionCompletedEvent {
    /**
     * Creates a new ServiceSessionCompletedEvent instance [创建新的服务会话完成事件实例]
     * 
     * @param payload The event payload containing session data [包含会话数据的事件载荷]
     * @param source The source information [来源信息]
     * @param version The event structure version [事件结构版本]
     */
    constructor(
        payload: ServiceSessionCompletedPayload,
        source?: { domain: string; service: string },
        version?: string
    ) {
        super(
            'services.session.completed',
            payload,
            source || {
                domain: 'services',
                service: 'session-service'
            },
            version || process.env.EVENT_VERSION || '1.0.0'
        );
    }
}