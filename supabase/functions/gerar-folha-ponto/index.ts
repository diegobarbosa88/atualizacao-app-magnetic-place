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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    let body: Record<string, string>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body JSON inválido." }, 400);
    }

    const { worker_id, mes } = body;
    if (!worker_id || !mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return json({ error: "Campos obrigatórios: worker_id, mes (formato YYYY-MM)." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

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

    const pdfBytes = await generateFolhaPontoPDF({
      workerName: worker.name,
      mes,
      logs: logs.map((l) => ({
        date: l.date,
        startTime: l.startTime,
        breakStart: l.breakStart,
        breakEnd: l.breakEnd,
        endTime: l.endTime,
        description: l.description,
        hours: l.hours,
        clientName: l.clientId ? (clientNameById.get(l.clientId) || "") : "",
      })),
    });

    const fileName = `folha-ponto/${worker_id}_${mes}_${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("documentos")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: false });
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

function nextMonth(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}
