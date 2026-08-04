import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  AUTH_API_ORIGIN,
  authBffHeaders,
  BACKEND_REFRESH_COMMAND,
  BACKEND_REFRESH_HANDOFF,
  backendRefreshCoordinator,
  fetchWithTimeout,
  verifyBackendRefreshCommand,
} from "@/lib/authRefresh";
import {
  expireBackendSession,
  readJwtExpiresAt,
  SESSION_EXPIRED_ERROR,
} from "@/lib/authTokenState";

class AdminCredentialsSignin extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

export const { auth, signIn, signOut, handlers, unstable_update } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          throw new AdminCredentialsSignin("credentials");
        }

        try {
          const response = await fetchWithTimeout(
            `${AUTH_API_ORIGIN}/api/auth/admin/signin`,
            {
              method: "POST",
              headers: authBffHeaders(),
              cache: "no-store",
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            },
          );

          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new AdminCredentialsSignin(
              typeof data?.errorCode === "string"
                ? data.errorCode
                : "credentials",
            );
          }

          const payload = data?.data ?? data;
          const user = payload?.user ?? payload?.admin;
          const accessToken =
            payload?.accessToken ?? payload?.token ?? payload?.access_token;
          const userId = user?._id ?? user?.id;
          if (
            !userId ||
            !accessToken ||
            typeof payload?.refreshToken !== "string"
          ) {
            throw new AdminCredentialsSignin("invalid_session");
          }

          return {
            id: userId,
            _id: userId,
            email: user?.email,
            name: user?.name,
            role: user?.role,
            avatar: user?.avatar,
            accessToken,
            accessTokenExpiresAt: payload.tokenExpiresAt,
            refreshToken: payload.refreshToken,
            refreshTokenExpiresAt: payload.refreshExpiresAt,
            sessionId: payload.sessionId,
          } as Record<string, unknown>;
        } catch (error) {
          if (error instanceof CredentialsSignin) throw error;
          throw new AdminCredentialsSignin("server_unavailable");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        return { ...token, ...user, authError: undefined };
      }
      const nextToken = { ...token };
      delete nextToken[BACKEND_REFRESH_HANDOFF];
      if (nextToken.authError === SESSION_EXPIRED_ERROR) return nextToken;
      if (typeof nextToken.refreshToken !== "string") {
        const legacyExpiresAt =
          typeof nextToken.accessTokenExpiresAt === "number"
            ? nextToken.accessTokenExpiresAt
            : readJwtExpiresAt(nextToken.accessToken);
        if (
          typeof nextToken.accessToken === "string" &&
          legacyExpiresAt &&
          Date.now() < legacyExpiresAt
        ) {
          return { ...nextToken, accessTokenExpiresAt: legacyExpiresAt };
        }
        return expireBackendSession(nextToken);
      }
      if (
        typeof nextToken.refreshTokenExpiresAt === "number" &&
        Date.now() >= nextToken.refreshTokenExpiresAt
      ) {
        return expireBackendSession(nextToken);
      }

      const sessionId =
        typeof nextToken.sessionId === "string" ? nextToken.sessionId : "";
      const forceRefresh =
        trigger === "update" &&
        Boolean(sessionId) &&
        (await verifyBackendRefreshCommand(
          (session as Record<string, unknown> | undefined)?.[
            BACKEND_REFRESH_COMMAND
          ],
          sessionId,
        ));
      if (!forceRefresh) return nextToken;

      const refreshed = await backendRefreshCoordinator.refresh(nextToken);
      if (
        typeof refreshed.accessToken === "string" &&
        typeof refreshed.refreshToken === "string" &&
        refreshed.authError === undefined
      ) {
        return Object.assign(refreshed, {
          [BACKEND_REFRESH_HANDOFF]: true,
        });
      }
      return refreshed;
    },
    async session({ session, token }) {
      if (token) {
        Object.assign(session.user, {
          id: token.id || token.sub,
          _id: token._id || token.sub,
          name: token.name,
          email: token.email,
          role: token.role,
          avatar: token.avatar,
        });
        Object.assign(session, {
          authError: token.authError,
          backendAccessExpired:
            typeof token.accessTokenExpiresAt === "number" &&
            Date.now() >= token.accessTokenExpiresAt,
        });
        if (token[BACKEND_REFRESH_HANDOFF] === true) {
          Object.assign(session, {
            [BACKEND_REFRESH_HANDOFF]: {
              accessToken: token.accessToken,
              accessTokenExpiresAt: token.accessTokenExpiresAt,
              refreshToken: token.refreshToken,
              refreshTokenExpiresAt: token.refreshTokenExpiresAt,
              sessionId: token.sessionId,
            },
          });
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
});
