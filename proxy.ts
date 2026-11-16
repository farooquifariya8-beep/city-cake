import { convexAuthNextjsProxy, nextjsProxyRedirect } from "@/lib/convexAuth";
import { safeNext } from "@/lib/format";

// The landing page is public. Every app page needs an account.
const PROTECTED = ["/explore", "/nearby", "/map", "/plan", "/place", "/assistant", "/journey", "/saved"];
const AUTH_PAGES = ["/signin", "/signup"];
/** Where a new session lands: planning the trip. */
const HOME_AFTER_SIGN_IN = "/plan";

export default convexAuthNextjsProxy(async (request, { isAuthenticated }) => {
  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.includes(path);
  if (!needsAuth && !isAuthPage) return;

  const authed = await isAuthenticated();
  if (needsAuth && !authed) {
    const next = `${path}${request.nextUrl.search}`;
    return nextjsProxyRedirect(request, `/signin?next=${encodeURIComponent(next)}`);
  }
  if (isAuthPage && authed) {
    return nextjsProxyRedirect(request, safeNext(request.nextUrl.searchParams.get("next"), HOME_AFTER_SIGN_IN));
  }
});

export const config = {
  matcher: ["/((?!auth(?:/|$)|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
