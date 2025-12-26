import { Module } from '@nestjs/common';
import { ServicesQueryRepositoriesModule } from './infrastructure/query-repositories.module';
import { SessionTypesQueryRepositoriesModule } from './session-types/infrastructure/query-repositories.module';
import { RecommLetterTypesQueryRepositoriesModule } from './recomm-letter-types/infrastructure/query-repositories.module';
import { CommSessionsQueryRepositoriesModule } from './comm-session/infrastructure/query-repositories.module';
import { RegularMentoringQueryRepositoriesModule } from './regular-mentoring/infrastructure/query-repositories.module';
import { GapAnalysisQueryRepositoriesModule } from './gap-analysis/infrastructure/query-repositories.module';
import { AiCareerQueryRepositoriesModule } from './ai-career/infrastructure/query-repositories.module';
import { ClassSessionsQueryRepositoriesModule } from './class-session/infrastructure/query-repositories.module';
import { MockInterviewsQueryRepositoriesModule } from './mock-interviews/infrastructure/query-repositories.module';
import { GetClassesUseCase } from './class/use-cases/get-classes.use-case';
import { GetClassMentorsUseCase } from './class/use-cases/get-class-mentors.use-case';
import { GetClassStudentsUseCase } from './class/use-cases/get-class-students.use-case';
import { GetClassCounselorsUseCase } from './class/use-cases/get-class-counselors.use-case';
import { GetSessionTypesUseCase } from './session-types/use-cases/get-session-types.use-case';
import { GetRecommLetterTypesUseCase } from './recomm-letter-types/use-cases/get-recomm-letter-types.use-case';
import { GetCommSessionByIdUseCase } from './comm-session/use-cases/get-comm-session-by-id.use-case';
import { GetStudentCommSessionsUseCase } from './comm-session/use-cases/get-student-comm-sessions.use-case';
import { GetMentorCommSessionsUseCase } from './comm-session/use-cases/get-mentor-comm-sessions.use-case';
import { GetCommSessionsByStudentIdsUseCase } from './comm-session/use-cases/get-comm-sessions-by-student-ids.use-case';
import { GetRegularMentoringByIdUseCase } from './regular-mentoring/use-cases/get-regular-mentoring-by-id.use-case';
import { GetStudentRegularMentoringSessionsUseCase } from './regular-mentoring/use-cases/get-student-regular-mentoring-sessions.use-case';
import { GetMentorRegularMentoringSessionsUseCase } from './regular-mentoring/use-cases/get-mentor-regular-mentoring-sessions.use-case';
import { GetRegularMentoringSessionsByStudentIdsUseCase } from './regular-mentoring/use-cases/get-regular-mentoring-sessions-by-student-ids.use-case';
import { GetGapAnalysisByIdUseCase } from './gap-analysis/use-cases/get-gap-analysis-by-id.use-case';
import { GetStudentGapAnalysisSessionsUseCase } from './gap-analysis/use-cases/get-student-gap-analysis-sessions.use-case';
import { GetMentorGapAnalysisSessionsUseCase } from './gap-analysis/use-cases/get-mentor-gap-analysis-sessions.use-case';
import { GetGapAnalysisSessionsByStudentIdsUseCase } from './gap-analysis/use-cases/get-gap-analysis-sessions-by-student-ids.use-case';
import { GetAiCareerByIdUseCase } from './ai-career/use-cases/get-ai-career-by-id.use-case';
import { GetStudentAiCareerSessionsUseCase } from './ai-career/use-cases/get-student-ai-career-sessions.use-case';
import { GetMentorAiCareerSessionsUseCase } from './ai-career/use-cases/get-mentor-ai-career-sessions.use-case';
import { GetAiCareerSessionsByStudentIdsUseCase } from './ai-career/use-cases/get-ai-career-sessions-by-student-ids.use-case';
import { GetClassSessionByIdUseCase } from './class-session/use-cases/get-class-session-by-id.use-case';
import { GetClassSessionsByClassUseCase } from './class-session/use-cases/get-class-sessions-by-class.use-case';
import { GetMentorClassSessionsUseCase } from './class-session/use-cases/get-mentor-class-sessions.use-case';
import { GetMockInterviewByIdUseCase } from './mock-interviews/use-cases/get-mock-interview-by-id.use-case';
import { GetStudentMockInterviewsUseCase } from './mock-interviews/use-cases/get-student-mock-interviews.use-case';
import { GetCounselorMockInterviewsUseCase } from './mock-interviews/use-cases/get-counselor-mock-interviews.use-case';
import { GetMockInterviewsByStudentIdsUseCase } from './mock-interviews/use-cases/get-mock-interviews-by-student-ids.use-case';

@Module({
  imports: [
    ServicesQueryRepositoriesModule,
    SessionTypesQueryRepositoriesModule,
    RecommLetterTypesQueryRepositoriesModule,
    CommSessionsQueryRepositoriesModule,
    RegularMentoringQueryRepositoriesModule,
    GapAnalysisQueryRepositoriesModule,
    AiCareerQueryRepositoriesModule,
    ClassSessionsQueryRepositoriesModule,
    MockInterviewsQueryRepositoriesModule,
  ],
  providers: [
    GetClassesUseCase,
    GetClassMentorsUseCase,
    GetClassStudentsUseCase,
    GetClassCounselorsUseCase,
    GetSessionTypesUseCase,
    GetRecommLetterTypesUseCase,
    GetCommSessionByIdUseCase,
    GetStudentCommSessionsUseCase,
    GetMentorCommSessionsUseCase,
    GetCommSessionsByStudentIdsUseCase,
    GetRegularMentoringByIdUseCase,
    GetStudentRegularMentoringSessionsUseCase,
    GetMentorRegularMentoringSessionsUseCase,
    GetRegularMentoringSessionsByStudentIdsUseCase,
    GetGapAnalysisByIdUseCase,
    GetStudentGapAnalysisSessionsUseCase,
    GetMentorGapAnalysisSessionsUseCase,
    GetGapAnalysisSessionsByStudentIdsUseCase,
    GetAiCareerByIdUseCase,
    GetStudentAiCareerSessionsUseCase,
    GetMentorAiCareerSessionsUseCase,
    GetAiCareerSessionsByStudentIdsUseCase,
    GetClassSessionByIdUseCase,
    GetClassSessionsByClassUseCase,
    GetMentorClassSessionsUseCase,
    GetMockInterviewByIdUseCase,
    GetStudentMockInterviewsUseCase,
    GetCounselorMockInterviewsUseCase,
    GetMockInterviewsByStudentIdsUseCase,
  ],
  exports: [
    GetClassesUseCase,
    GetClassMentorsUseCase,
    GetClassStudentsUseCase,
    GetClassCounselorsUseCase,
    GetSessionTypesUseCase,
    GetRecommLetterTypesUseCase,
    GetCommSessionByIdUseCase,
    GetStudentCommSessionsUseCase,
    GetMentorCommSessionsUseCase,
    GetCommSessionsByStudentIdsUseCase,
    GetRegularMentoringByIdUseCase,
    GetStudentRegularMentoringSessionsUseCase,
    GetMentorRegularMentoringSessionsUseCase,
    GetRegularMentoringSessionsByStudentIdsUseCase,
    GetGapAnalysisByIdUseCase,
    GetStudentGapAnalysisSessionsUseCase,
    GetMentorGapAnalysisSessionsUseCase,
    GetGapAnalysisSessionsByStudentIdsUseCase,
    GetAiCareerByIdUseCase,
    GetStudentAiCareerSessionsUseCase,
    GetMentorAiCareerSessionsUseCase,
    GetAiCareerSessionsByStudentIdsUseCase,
    GetClassSessionByIdUseCase,
    GetClassSessionsByClassUseCase,
    GetMentorClassSessionsUseCase,
    GetMockInterviewByIdUseCase,
    GetStudentMockInterviewsUseCase,
    GetCounselorMockInterviewsUseCase,
    GetMockInterviewsByStudentIdsUseCase,
  ],
})
export class ServicesQueriesModule {}
