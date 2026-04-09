import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      _id?: string;
      role?: string;
      avatar?: string;
      accessToken?: string;
    };
  }

  interface User {
    id?: string;
    _id?: string;
    role?: string;
    avatar?: string;
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    _id?: string;
    role?: string;
    avatar?: string;
    accessToken?: string;
  }
}

