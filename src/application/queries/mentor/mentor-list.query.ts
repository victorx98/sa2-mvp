import { Injectable } from "@nestjs/common";
import {
  MentorQueryService,
  MentorListItem,
} from "@domains/query/services/mentor-query.service";

@Injectable()
export class MentorListQuery {
  constructor(private readonly mentorQueryService: MentorQueryService) {}

  async execute(search?: string): Promise<MentorListItem[]> {
    return this.mentorQueryService.findAll(search);
  }
}

