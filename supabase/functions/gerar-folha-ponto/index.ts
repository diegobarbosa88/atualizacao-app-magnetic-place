import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { generateFolhaPontoPDF } from "./pdfGenerator.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function nextMonth(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    let body: Record<string, string>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body JSON inválido." }, 400);
    }

    const { worker_id, client_nome, mes } = body;
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return json({ error: "Campo obrigatório: mes (formato YYYY-MM)." }, 400);
    }
    if (!worker_id && !client_nome) {
      return json({ error: "Indica worker_id (um trabalhador) ou client_nome (todos os trabalhadores de um cliente)." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let logoBytes: Uint8Array | null = null;
    try {
      const logoRes = await fetch("https://app-magnetic.vercel.app/MAGNETIC%20(3).png");
      if (logoRes.ok) logoBytes = new Uint8Array(await logoRes.arrayBuffer());
    } catch (_) { /* segue sem logo */ }

    // ── Modo cliente: todas as folhas de todos os trabalhadores desse cliente ──
    if (client_nome) {
      const { data: clientes, error: clientErr } = await supabase
        .from("clients")
        .select("id, name")
        .ilike("name", `%${client_nome}%`);
      if (clientErr) return json({ error: clientErr.message }, 500);
      if (!clientes || clientes.length === 0) {
        return json({ error: `Nenhum cliente encontrado com o nome "${client_nome}".` }, 404);
      }
      if (clientes.length > 1) {
        return json({
          error: `Mais do que um cliente corresponde a "${client_nome}": ${clientes.map((c) => c.name).join(", ")}. Especifica melhor.`,
        }, 400);
      }
      const cliente = clientes[0];

      const { data: logs, error: logsErr } = await supabase
        .from("logs")
        .select("date, startTime, breakStart, breakEnd, endTime, description, hours, clientId, workerId")
        .eq("clientId", cliente.id)
        .gte("date", `${mes}-01`)
        .lt("date", nextMonth(mes))
        .order("date", { ascending: true });
      if (logsErr) return json({ error: logsErr.message }, 500);
      if (!logs || logs.length === 0) {
        return json({ error: `Sem registos de horas para "${cliente.name}" em ${mes}.` }, 404);
      }

      const workerIds = [...new Set(logs.map((l) => l.workerId).filter(Boolean))];
      const { data: workersData, error: workersErr } = await supabase
        .from("workers")
        .select("id, name")
        .in("id", workerIds);
      if (workersErr) return json({ error: workersErr.message }, 500);
      const workerNameById = new Map<string, string>();
      for (const w of workersData || []) workerNameById.set(w.id, w.name);

      const workers = workerIds
        .map((wId) => ({
          workerName: workerNameById.get(wId) || wId,
          logs: logs
            .filter((l) => l.workerId === wId)
            .map((l) => ({
              date: l.date, startTime: l.startTime, breakStart: l.breakStart, breakEnd: l.breakEnd,
              endTime: l.endTime, description: l.description, hours: l.hours,
              clientId: l.clientId, clientName: cliente.name,
            })),
        }))
        .sort((a, b) => a.workerName.localeCompare(b.workerName));

      const { bytes, totalPorTrabalhador } = await generateFolhaPontoPDF({ mes, workers, logoBytes });

      const fileName = `folha-ponto/cliente_${cliente.id}_${mes}_${Date.now()}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from("documentos")
        .upload(fileName, bytes, { contentType: "application/pdf", upsert: false });
      if (uploadErr) return json({ error: `Erro ao guardar PDF: ${uploadErr.message}` }, 500);

      const { data: urlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
      const totalGeral = Object.values(totalPorTrabalhador).reduce((a, b) => a + b, 0);

      return json({
        success: true,
        client_name: cliente.name,
        mes,
        n_trabalhadores: workers.length,
        total_horas: totalGeral,
        pdf_url: urlData?.publicUrl ?? null,
      });
    }

    // ── Modo trabalhador único ─────────────────────────────────────
    const { data: worker, error: workerErr } = await supabase
      .from("workers")
      .select("id, name")
      .eq("id", worker_id)
      .maybeSingle();
    if (workerErr) return json({ error: workerErr.message }, 500);
    if (!worker) return json({ error: "Trabalhador não encontrado." }, 404);

    const { data: logs, error: logsErr } = await supabase
      .from("logs")
      .select("date, startTime, breakStart, breakEnd, endTime, description, hours, clientId")
      .eq("workerId", worker_id)
      .gte("date", `${mes}-01`)
      .lt("date", nextMonth(mes))
      .order("date", { ascending: true });
    if (logsErr) return json({ error: logsErr.message }, 500);

    if (!logs || logs.length === 0) {
      return json({ error: `Sem registos de horas para ${worker.name} em ${mes}.` }, 404);
    }

    const clientIds = [...new Set(logs.map((l) => l.clientId).filter(Boolean))];
    const clientNameById = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
      for (const c of clients || []) clientNameById.set(c.id, c.name);
    }

    const totalHoras = logs.reduce((acc, l) => acc + (l.hours || 0), 0);

    const { bytes } = await generateFolhaPontoPDF({
      mes,
      logoBytes,
      workers: [{
        workerName: worker.name,
        logs: logs.map((l) => ({
          date: l.date,
          startTime: l.startTime,
          breakStart: l.breakStart,
          breakEnd: l.breakEnd,
          endTime: l.endTime,
          description: l.description,
          hours: l.hours,
          clientId: l.clientId,
          clientName: l.clientId ? (clientNameById.get(l.clientId) || "") : "",
        })),
      }],
    });

    const fileName = `folha-ponto/${worker_id}_${mes}_${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("documentos")
      .upload(fileName, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadErr) return json({ error: `Erro ao guardar PDF: ${uploadErr.message}` }, 500);

    const { data: urlData } = supabase.storage.from("documentos").getPublicUrl(fileName);

    return json({
      success: true,
      worker_name: worker.name,
      mes,
      total_horas: totalHoras,
      pdf_url: urlData?.publicUrl ?? null,
    });
  } catch (err) {
    console.error("[gerar-folha-ponto] Erro inesperado:", err);
    return json({ error: (err as Error).message ?? "Erro interno." }, 500);
  }
});
