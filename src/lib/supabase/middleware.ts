import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * updateSession: chamado no proxy.ts raiz. Atualiza o cookie de sessão
 * do Supabase a cada request e redireciona usuários não autenticados
 * que tentam acessar rotas protegidas.
 *
 * Também injeta o pathname no header `x-pathname` da request pra que
 * server components saibam a URL atual via headers().get('x-pathname').
 */
export async function updateSession(request: NextRequest) {
  // Headers da request com x-pathname injetado.
  // Em Next 16, mutar request.headers direto não propaga — tem que
  // criar Headers novo e passar via NextResponse.next({ request: { headers } }).
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: reqHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: reqHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: não adicionar lógica entre o createServerClient e o getUser.
  // Um erro aqui pode invalidar a sessão.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/app") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/verificacao") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/redefinir-senha");
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/cadastro") ||
    pathname.startsWith("/recuperar-senha");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
