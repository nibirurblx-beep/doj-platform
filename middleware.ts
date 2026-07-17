import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client with cookies from the request.
  // The client will refresh the session if needed.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Routes that require authentication
  const protectedRoutes = ["/portal", "/applicant"];
  const isProtected = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check suspension status for authenticated users on protected routes
  if (isProtected && user) {
    const { data: status } = await supabase
      .from("user_security_status")
      .select("suspended_at")
      .eq("user_id", user.id)
      .single();

    if (status?.suspended_at) {
      // Redirect to suspended page
      return NextResponse.redirect(new URL("/auth/suspended", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match portal and applicant routes
    "/portal/:path*",
    "/applicant/:path*",
    // Don't match static files and public routes
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
