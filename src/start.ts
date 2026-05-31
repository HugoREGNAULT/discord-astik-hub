import { createStart, createMiddleware } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// IMPORTANT: le hash 'sha256-BK/jIHDFyvjBs4rIV8ss3Kh1k83KUq0OG86SqDggeCk=' ci-dessous
// correspond au contenu EXACT de la constante `themeInit` dans src/routes/__root.tsx.
// Si vous modifiez `themeInit`, recalculez le hash (SHA-256, base64) et mettez-le à jour ici.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'sha256-BK/jIHDFyvjBs4rIV8ss3Kh1k83KUq0OG86SqDggeCk='",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://cdn.discordapp.com https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const res = await next();
  if (res instanceof Response) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!res.headers.has(name)) {
        res.headers.set(name, value);
      }
    }
  }
  return res;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
