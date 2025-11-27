import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { StudentQueryService } from "./services/student-query.service";
import { MentorQueryService } from "./services/mentor-query.service";
import { SchoolQueryService } from "./services/school-query.service";
import { MajorQueryService } from "./services/major-query.service";

/**
 * Query Domain Module
 * 职责：
 * 1. 提供跨域查询服务
 * 2. 构建 Read Model
 * 3. 高效查询，可以直接 join 各域表
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    StudentQueryService,
    MentorQueryService,
    SchoolQueryService,
    MajorQueryService,
  ],
  exports: [
    StudentQueryService,
    MentorQueryService,
    SchoolQueryService,
    MajorQueryService,
  ],
})
export class QueryModule {}
