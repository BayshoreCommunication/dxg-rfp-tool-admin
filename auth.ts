import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { auth, signIn, signOut, handlers } = NextAuth({
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
          return null;
        }

        const { BACKEND_URL } = await import("@/lib/config");
        const apiUrl = BACKEND_URL.endsWith("/api")
          ? BACKEND_URL.slice(0, -4)
          : BACKEND_URL;

        try {
          const response = await fetch(`${apiUrl}/api/auth/admin/signin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!response.ok) {
            return null;
          }

          const data = await response.json();
          const payload = data?.data ?? data;
          const user = payload?.user ?? payload?.admin;
          const accessToken =
            payload?.accessToken ?? payload?.token ?? payload?.access_token;

          const userId = user?._id ?? user?.id;
          if (!userId || !accessToken) {
            return null;
          }

          return {
            id: userId,
            _id: userId,
            email: user?.email,
            name: user?.name,
            role: user?.role,
            avatar: user?.avatar,
            accessToken,
          } as Record<string, unknown>;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return { ...token, ...user };
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        const user = { ...session.user };

        if (typeof token.id === "string") {
          user.id = token.id;
        }

        if (typeof token._id === "string") {
          user._id = token._id;
        }

        if (typeof token.role === "string") {
          user.role = token.role;
        }

        if (typeof token.avatar === "string") {
          user.avatar = token.avatar;
        }

        if (typeof token.accessToken === "string") {
          user.accessToken = token.accessToken;
        }

        session.user = user;
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
