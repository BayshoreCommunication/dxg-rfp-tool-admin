/**
 * The admin app names its session cookie distinctly from the planner
 * dashboard's default `authjs.session-token`. Cookies are scoped by host, not
 * port, so on localhost the two apps would otherwise overwrite each other's
 * sign-in; in production the apps live on different hosts and this is simply
 * a clearer name. The `__Secure-` prefix is required when the cookie is secure.
 */
const secure = process.env.NODE_ENV === "production";

export const ADMIN_SESSION_COOKIE_NAME = secure
  ? "__Secure-admin.authjs.session-token"
  : "admin.authjs.session-token";

export const ADMIN_SESSION_COOKIE_SECURE = secure;
