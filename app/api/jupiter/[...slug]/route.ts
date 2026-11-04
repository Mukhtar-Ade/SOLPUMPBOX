import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

function getTarget(slug: string[], search: string) {
  const path = slug.join('/');
  if (path === 'quote') return `https://lite-api.jup.ag/swap/v1/quote${search}`;
  if (path === 'swap') return `https://lite-api.jup.ag/swap/v1/swap${search}`;
  if (path === 'swap-instructions') return `https://lite-api.jup.ag/swap/v1/swap-instructions${search}`;
  if (path.startsWith('price')) return `https://api.jup.ag/price/v2${search ? search : ''}`;
  if (path.startsWith('tokens')) return `https://api.jup.ag/tokens/v1/${path.replace('tokens/', '')}${search}`;
  return `https://lite-api.jup.ag/swap/v1/${path}${search}`;
}

async function handler(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const url = new URL(req.url);
  const target = getTarget(params.slug || [], url.search);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env.JUPITER_API_KEY || process.env.NEXT_PUBLIC_JUPITER_API_KEY;
  if (apiKey) headers['x-api-key'] = apiKey;
  let body: any = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try { body = await req.text(); } catch {}
  }
  try {
    const res = await fetch(target, { method: req.method, headers, body: body || undefined });
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Proxy failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: any) { return handler(req, ctx); }
export async function POST(req: NextRequest, ctx: any) { return handler(req, ctx); }
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' } });
}
