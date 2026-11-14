import { convexAuthNextjsProxy, nextjsProxyRedirect } from "@/lib/convexAuth";

// Browsing is open to everyone. Only /saved needs an account.
const PROTECTED = ["/saved"];
const AUTH_PAGES = ["/signin", "/signup"];

export default convexAuthNextjsProxy(async (request, { isAuthenticated }) => {
  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.includes(path);
  if (!needsAuth && !isAuthPage) return;

  const authed = await isAuthenticated();
  if (needsAuth && !authed) {
    return nextjsProxyRedirect(request, `/signin?next=${encodeURIComponent(path)}`);
  }
  if (isAuthPage && authed) {
    return nextjsProxyRedirect(request, "/explore");
  }
});

export const config = {
  matcher: ["/((?!auth(?:/|$)|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
