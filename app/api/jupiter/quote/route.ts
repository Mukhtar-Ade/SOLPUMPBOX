export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  const slippageBps = searchParams.get("slippageBps") || "100";

  if (!inputMint || !outputMint || !amount) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps,
  });

  const primaryUrl = `https://api.jup.ag/swap/v1/quote?${params.toString()}`;
  console.log("[Jupiter] Trying primary:", primaryUrl);

  let res = await fetch(primaryUrl, {
    headers: { "Content-Type": "application/json" },
  });

  if (res.status === 404) {
    const fallbackUrl = `https://quote-api.jup.ag/v6/quote?${params.toString()}`;
    console.log("[Jupiter] Primary 404, trying fallback:", fallbackUrl);
    res = await fetch(fallbackUrl, {
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await res.json();
  console.log("[Jupiter] Status:", res.status);

  return Response.json(data, { status: res.status });
}
