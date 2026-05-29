import { NextRequest, NextResponse } from 'next/server';

// Route pubbliche — nessuna sessione richiesta
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/ical/',           // feed iCal per Airbnb / Booking.com
  '/registrazione/',
  '/api/registrazione/', // guest self-registration via token
  '/api/webhooks/',      // webhook esterni (Booking.com)
];

async function tokenValido(token: string): Promise<boolean> {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) return false;

    const dot = token.lastIndexOf('.');
    if (dot < 1) return false;
    const payload = token.slice(0, dot);
    const sig     = token.slice(dot + 1);

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const b64 = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/');
    const sigBytes = new Uint8Array(Array.from(atob(b64(sig)), c => c.charCodeAt(0)));
    const ok = await crypto.subtle.verify(
      'HMAC', key, sigBytes, new TextEncoder().encode(payload),
    );
    if (!ok) return false;

    const data = JSON.parse(atob(b64(payload)));
    return typeof data.e === 'number' && data.e > Date.now();
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('session')?.value;
  const valido = token ? await tokenValido(token) : false;

  if (!valido) {
    // API → 401 JSON; pagine → redirect al login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|icon-.*\\.png).*)',
  ],
};
