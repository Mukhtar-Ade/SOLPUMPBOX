const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const QUOTE_ENDPOINTS = [
  "https://quote-api.jup.ag/v6/quote",
  "https://api.jup.ag/v6/quote",
];

const SWAP_ENDPOINTS = [
  "https://quote-api.jup.ag/v6/swap",
  "https://api.jup.ag/v6/swap",
];

async function fetchWithFallback(
  endpoints: string[],
  init: RequestInit,
): Promise<{ res: Response; url: string }> {
  let lastError: Error | null = null;
  for (const endpoint of endpoints) {
    const fullUrl = init.method === "POST" ? endpoint : endpoint;
    console.log("[jupiter-proxy] trying:", fullUrl);
    try {
      const res = await fetch(fullUrl, {
        ...init,
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return { res, url: fullUrl };
      const body = await res.text().catch(() => "");
      console.warn(`[jupiter-proxy] ${fullUrl} returned ${res.status}:`, body.slice(0, 300));
      lastError = new Error(`${fullUrl} returned ${res.status}: ${body.slice(0, 200)}`);
    } catch (err) {
      console.warn(`[jupiter-proxy] ${fullUrl} threw:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error("All Jupiter endpoints failed");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/functions\/v1\/jupiter-proxy\/?/, "");
    const method = req.method;

    // Route: GET /quote — proxy Jupiter v6 quote
    if (path === "quote" && method === "GET") {
      const params = url.searchParams;
      const inputMint = params.get("inputMint");
      const outputMint = params.get("outputMint");
      const amount = params.get("amount");
      const slippageBps = params.get("slippageBps") ?? "300";

      if (!inputMint || !outputMint || !amount) {
        return new Response(
          JSON.stringify({ error: "Missing required params: inputMint, outputMint, amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const buildUrl = (base: string) => {
        const u = new URL(base);
        u.searchParams.set("inputMint", inputMint);
        u.searchParams.set("outputMint", outputMint);
        u.searchParams.set("amount", amount);
        u.searchParams.set("slippageBps", slippageBps);
        return u.toString();
      };

      const { res, url: usedUrl } = await fetchWithFallback(
        QUOTE_ENDPOINTS.map(buildUrl),
        { headers: { "Accept": "application/json" } },
      );

      console.log("[jupiter-proxy] quote success from:", usedUrl);
      const quoteData = await res.json();
      return new Response(
        JSON.stringify(quoteData),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Route: POST /swap — proxy Jupiter v6 swap transaction
    if (path === "swap" && method === "POST") {
      const body = await req.json();
      const { quoteResponse, userPublicKey, wrapAndUnwrapSol } = body;

      if (!quoteResponse || !userPublicKey) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: quoteResponse, userPublicKey" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const swapBody = JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: wrapAndUnwrapSol ?? true,
      });

      const { res, url: usedUrl } = await fetchWithFallback(
        SWAP_ENDPOINTS,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: swapBody,
        },
      );

      console.log("[jupiter-proxy] swap success from:", usedUrl);
      const swapData = await res.json();
      return new Response(
        JSON.stringify(swapData),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Route: GET /price — proxy Jupiter price API
    if (path === "price" && method === "GET") {
      const ids = url.searchParams.get("ids");
      if (!ids) {
        return new Response(
          JSON.stringify({ error: "Missing required param: ids" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const priceUrl = `https://api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`;
      console.log("[jupiter-proxy] price:", priceUrl);
      const priceRes = await fetch(priceUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { "Accept": "application/json" },
      });
      if (!priceRes.ok) {
        const body = await priceRes.text().catch(() => "");
        console.error("[jupiter-proxy] price failed:", priceRes.status, body);
        return new Response(
          JSON.stringify({ error: `Price request failed (${priceRes.status})` }),
          { status: priceRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const priceData = await priceRes.json();
      return new Response(
        JSON.stringify(priceData),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown route: ${method} ${path}` }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[jupiter-proxy] unhandled error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
