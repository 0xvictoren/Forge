import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { AUTH_RETURN_KEY } from "@/lib/nav-config";
import { normalizeReturnPath } from "@/lib/auth-redirect";

/** Read stored return path from sessionStorage or URL query. */
export function getStoredReturnPath(): string | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const queryReturn = normalizeReturnPath(params.get("return"));
  const stored = normalizeReturnPath(sessionStorage.getItem(AUTH_RETURN_KEY));

  if (queryReturn) {
    sessionStorage.setItem(AUTH_RETURN_KEY, queryReturn);
    return queryReturn;
  }

  return stored;
}

/** Navigate to the stored return destination after successful auth. */
export function navigateToReturnPath(router: AppRouterInstance): boolean {
  const target = getStoredReturnPath();
  if (!target || target === window.location.pathname) {
    clearReturnFromUrl(router);
    return false;
  }

  sessionStorage.removeItem(AUTH_RETURN_KEY);
  router.replace(target);
  return true;
}

export function clearReturnFromUrl(router: AppRouterInstance) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("return")) return;
  params.delete("return");
  const qs = params.toString();
  router.replace(window.location.pathname + (qs ? `?${qs}` : ""));
}