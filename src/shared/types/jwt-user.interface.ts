// JWT authenticated user interface
export interface IJwtUser {
  userId: string;
  email: string;
  [key: string]: unknown; // Allow additional properties from validateUser
}

// JWT payload interface
export interface IJwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
