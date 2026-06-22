import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password"]
const PUBLIC_PREFIXES = ["/api/"]
const ONBOARDING_PAGO = "/onboarding/pago"
const PAYWALL_PATH = "/pagos/renovar"
const PAYWALL_EXEMPT = [ONBOARDING_PAGO, PAYWALL_PATH, "/pagos/success", "/pagos/failure", "/pagos/pending", "/saas-admin/activate"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    if (!isPublic) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAll: (cookiesToSet: any[]) => {
        cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(
          ({ name, value, options }: { name: string; value: string; options?: object }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response.cookies.set(name, value, options as any)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Usuarios autenticados: verificar gym_id y membresía activa
  if (user && !isPublic && !PAYWALL_EXEMPT.includes(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("gym_id, role, membership_expires_at")
      .eq("id", user.id)
      .single()

    if (!profile?.gym_id) {
      const url = request.nextUrl.clone()
      url.pathname = ONBOARDING_PAGO
      return NextResponse.redirect(url)
    }

    // Admins y trainers nunca quedan bloqueados por membresía
    const isBlocked = profile.role === "member" &&
      (!profile.membership_expires_at || new Date(profile.membership_expires_at) < new Date())

    if (isBlocked) {
      const url = request.nextUrl.clone()
      url.pathname = PAYWALL_PATH
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
