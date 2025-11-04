export interface User {
  id: string;
  gender?: string;
  nickname?: string;
  cnNickname?: string;
  status?: string;
  account?: string;
  email?: string;
  country?: string;
  createdTime?: Date;
  modifiedTime?: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface UserWithPassword extends User {
  password: string;
}
