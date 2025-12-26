import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IUserService,
  USER_SERVICE,
  User,
} from '@domains/identity/user/user-interface';

export interface UserReadModel {
  id: string;
  email: string;
  nameEn: string;
  nameZh: string;
  status?: string;
  country?: string;
  gender?: string;
  roles?: string[];
  createdTime?: Date;
  modifiedTime?: Date;
}

export interface GetUserByIdDto {
  userId: string;
}

export interface GetUserByEmailDto {
  email: string;
}

export interface GetUsersByIdsDto {
  userIds: string[];
}
