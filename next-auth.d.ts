import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      _id?: string;
      role?: string;
      avatar?: string;
    };
    authError?: string;
    backendAccessExpired?: boolean;
  }

  interface User {
    id?: string;
    _id?: string;
    role?: string;
    avatar?: string;
    accessToken?: string;
    accessTokenExpiresAt?: number;
    refreshToken?: string;
    refreshTokenExpiresAt?: number;
    sessionId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    _id?: string;
    role?: string;
    avatar?: string;
    accessToken?: string;
    accessTokenExpiresAt?: number;
    refreshToken?: string;
    refreshTokenExpiresAt?: number;
    sessionId?: string;
    authError?: string;
  }
}
