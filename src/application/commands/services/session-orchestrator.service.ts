import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { RegularMentoringService } from './regular-mentoring.service';
import { GapAnalysisService } from './gap-analysis.service';
import { AiCareerService } from './ai-career.service';
import { SessionType } from '@domains/services/sessions/shared/enums/session-type.enum';

/**
 * Session Orchestrator Service
 * 
 * Purpose: Acts as a facade/strategy coordinator for different session types
 * Routes requests to appropriate application service based on sessionType
 * 
 * Pattern: Facade + Strategy Pattern
 */
@Injectable()
export class SessionOrchestratorService {
  private readonly logger = new Logger(SessionOrchestratorService.name);

  constructor(
    private readonly regularMentoringService: RegularMentoringService,
    private readonly gapAnalysisService: GapAnalysisService,
    private readonly aiCareerService: AiCareerService,
  ) {}

  /**
   * Create session - routes to appropriate service based on sessionType
   */
  async createSession(sessionType: string, dto: any) {
    this.logger.log(`Orchestrating createSession for type: ${sessionType}`);
    const service = this.getServiceByType(sessionType);
    return service.createSession(dto);
  }

  /**
   * Get sessions list - routes to appropriate service based on sessionType
   */
  async getSessionsByRole(
    sessionType: string,
    userId: string,
    userRole: string,
    filters?: any,
  ) {
    this.logger.log(`Orchestrating getSessionsByRole for type: ${sessionType}`);
    const service = this.getServiceByType(sessionType);
    return service.getSessionsByRole(userId, userRole, filters);
  }

  /**
   * Get session by ID - routes to appropriate service based on sessionType
   */
  async getSessionById(sessionType: string, sessionId: string) {
    this.logger.log(`Orchestrating getSessionById for type: ${sessionType}`);
    const service = this.getServiceByType(sessionType);
    return service.getSessionById(sessionId);
  }

  /**
   * Update session - routes to appropriate service based on sessionType
   */
  async updateSession(sessionType: string, sessionId: string, dto: any) {
    this.logger.log(`Orchestrating updateSession for type: ${sessionType}`);
    const service = this.getServiceByType(sessionType);
    return service.updateSession(sessionId, dto);
  }

  /**
   * Cancel session - routes to appropriate service based on sessionType
   */
  async cancelSession(sessionType: string, sessionId: string, reason?: string) {
    this.logger.log(`Orchestrating cancelSession for type: ${sessionType}`);
    const service = this.getServiceByType(sessionType);
    return service.cancelSession(sessionId, reason);
  }

  /**
   * Delete session - routes to appropriate service based on sessionType
   */
  async deleteSession(sessionType: string, sessionId: string) {
    this.logger.log(`Orchestrating deleteSession for type: ${sessionType}`);
    const service = this.getServiceByType(sessionType);
    return service.deleteSession(sessionId);
  }

  /**
   * Strategy pattern: Get appropriate service based on session type
   */
  private getServiceByType(sessionType: string) {
    const strategies: Record<string, any> = {
      [SessionType.REGULAR_MENTORING]: this.regularMentoringService,
      [SessionType.GAP_ANALYSIS]: this.gapAnalysisService,
      [SessionType.AI_CAREER]: this.aiCareerService,
    };

    const service = strategies[sessionType];
    if (!service) {
      throw new BadRequestException(
        `Unsupported session type: ${sessionType}. Supported types: ${Object.keys(strategies).join(', ')}`,
      );
    }

    return service;
  }

  /**
   * Get all supported session types
   */
  getSupportedSessionTypes(): string[] {
    return [
      SessionType.REGULAR_MENTORING,
      SessionType.GAP_ANALYSIS,
      SessionType.AI_CAREER,
    ];
  }
}

