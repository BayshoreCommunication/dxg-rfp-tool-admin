const PRODUCTION_BACKEND_URL = "https://dxg-rfp-tool-backend.vercel.app";

/**
 * Externally reachable backend URL.
 * Set BACKEND_URL in your environment for local dev (e.g. http://localhost:8000).
 * On Vercel, set BACKEND_URL=https://dxg-rfp-tool-backend.vercel.app — or leave it
 * unset and the production URL is used as the safe default.
 */
export const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  PRODUCTION_BACKEND_URL
)
  .trim()
  .replace(/\/+$/, "");
