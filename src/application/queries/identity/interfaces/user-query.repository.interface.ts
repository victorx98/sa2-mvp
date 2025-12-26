import { UserReadModel } from '../models/user-read.model';

export const USER_QUERY_REPOSITORY = Symbol('USER_QUERY_REPOSITORY');
export { UserReadModel };

export interface IUserQueryRepository {
  getUserById(userId: string): Promise<UserReadModel | null>;
  getUserByEmail(email: string): Promise<UserReadModel | null>;
  getUsersByIds(userIds: string[]): Promise<UserReadModel[]>;
}
