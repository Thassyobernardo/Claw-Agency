
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // ── AUTH GUARD ───────────────────────────────────────────────────────
  // Endpoint dispara o Apify e custa $$ por call — apenas admins autorizados.
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { industry, city } = await request.json();
    const token = process.env.APIFY_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "APIFY_TOKEN is missing" }, { status: 500 });
    }

    const query = `${industry} in ${city}, Australia`;
    console.log(`🚀 Lead Hunter: searching "${query}" via compass/crawler-google-places`);

    // Usando o ator CORRETO: compass/crawler-google-places
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [query],
          maxCrawledPlacesPerSearch: 10,
          language: "en",
          deeperCityScrape: false,
          onePerQuery: false,
        }),
      }
    );

    if (!runResponse.ok) {
      const errText = await runResponse.text();
      console.error("Apify run start failed:", errText);
      return NextResponse.json({ error: `Apify error: ${runResponse.status}` }, { status: 502 });
    }

    const runData = await runResponse.json();
    const datasetId: string | undefined = runData.data?.defaultDatasetId;
    const runId: string | undefined = runData.data?.id;

    if (!datasetId || !runId) {
      return NextResponse.json({ error: "No run/dataset ID returned from Apify" }, { status: 502 });
    }

    // Polling: ate 60s. Detecta falha do actor cedo via runs/{runId}.
    interface ApifyPlace {
      title?: string;
      name?: string;
      website?: string;
      url?: string;
      phone?: string;
      phoneUnformatted?: string;
      address?: string;
      street?: string;
      totalScore?: number;
    }

    let items: ApifyPlace[] = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      console.log(`⏳ Polling attempt ${attempt + 1}/20...`);
      await new Promise((r) => setTimeout(r, 3000));

      // 1) Check run status — sai cedo se falhou
      const runStatusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
      );
      if (runStatusRes.ok) {
        const runStatus = await runStatusRes.json();
        const status: string = runStatus.data?.status ?? "";
        if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
          console.error(`Apify run ${runId} ended with status: ${status}`);
          return NextResponse.json(
            { error: `Apify run ${status.toLowerCase()}` },
            { status: 502 }
          );
        }
      }

      // 2) Check dataset items
      const dsRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=10`
      );

      if (dsRes.ok) {
        const parsed = await dsRes.json();
        if (Array.isArray(parsed) && parsed.length > 0) {
          items = parsed as ApifyPlace[];
          console.log(`✅ Found ${items.length} leads!`);
          break;
        }
      }
    }

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        leads: [],
        message: "Apify is still processing. Try again in 30 seconds.",
      });
    }

    // Mapear os resultados para o formato do nosso Lead Hunter
    const leads = items.map((item) => ({
      name: item.title || item.name || "Unknown",
      website: item.website || item.url || "#",
      phone: item.phone || item.phoneUnformatted || null,
      address: item.address || item.street || null,
      rating: item.totalScore || null,
      sector: industry,
    }));

    return NextResponse.json({ success: true, leads });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Lead Hunter critical error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
