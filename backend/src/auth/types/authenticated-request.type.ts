import { Request } from 'express';

export type AuthenticatedRequest = Request & {
  user: {
    userID: string;
    email?: string;
    role?: string;
  };
};
