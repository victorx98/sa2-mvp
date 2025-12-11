import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { StudentQueryService } from "./services/student-query.service";
import { MentorQueryService } from "./services/mentor-query.service";
import { CounselorQueryService } from "./services/counselor-query.service";
import { SchoolQueryService } from "./services/school-query.service";
import { MajorQueryService } from "./services/major-query.service";
import { RegularMentoringQueryService } from "./services/regular-mentoring-query.service";
import { GapAnalysisQueryService } from "./services/gap-analysis-query.service";
import { AiCareerQueryService } from "./services/ai-career-query.service";
import { CommSessionQueryService } from "./services/comm-session-query.service";
import { ClassSessionQueryService } from "./services/class-session-query.service";
import { ClassMentorPriceQueryService } from "./financial/class-mentor-price-query.service";
import { RegularMentoringModule } from "@domains/services/sessions/regular-mentoring/regular-mentoring.module";
import { GapAnalysisModule } from "@domains/services/sessions/gap-analysis/gap-analysis.module";
import { AiCareerModule } from "@domains/services/sessions/ai-career/ai-career.module";
import { CommSessionsModule } from "@domains/services/comm-sessions/comm-sessions.module";
import { ClassModule } from "@domains/services/class/class.module";

/**
 * Query Domain Module
 * 职责：
 * 1. 提供跨域查询服务
 * 2. 构建 Read Model
 * 3. 高效查询，可以直接 join 各域表
 */
@Module({
  imports: [
    DatabaseModule,
    RegularMentoringModule,
    GapAnalysisModule,
    AiCareerModule,
    CommSessionsModule,
    ClassModule,
  ],
  providers: [
    StudentQueryService,
    MentorQueryService,
    CounselorQueryService,
    SchoolQueryService,
    MajorQueryService,
    ClassMentorPriceQueryService,
    RegularMentoringQueryService,
    GapAnalysisQueryService,
    AiCareerQueryService,
    CommSessionQueryService,
    ClassSessionQueryService,
  ],
  exports: [
    StudentQueryService,
    MentorQueryService,
    CounselorQueryService,
    SchoolQueryService,
    MajorQueryService,
    ClassMentorPriceQueryService,
    RegularMentoringQueryService,
    GapAnalysisQueryService,
    AiCareerQueryService,
    CommSessionQueryService,
    ClassSessionQueryService,
  ],
})
export class QueryModule {}
