import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { generateFolhaPontoPDF } from "./pdfGenerator.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MESES_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

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

function dayAfter(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatDataPt(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
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

    const { worker_id, client_nome, profissao, mes, data_inicio, data_fim } = body;

    // ── Resolver o período ────────────────────────────────────────
    let periodoInicio: string, periodoFimExclusivo: string, periodoLabel: string, isPeriodoMensal: boolean;
    if (mes) {
      if (!/^\d{4}-\d{2}$/.test(mes)) return json({ error: "mes deve ter o formato YYYY-MM." }, 400);
      periodoInicio = `${mes}-01`;
      periodoFimExclusivo = nextMonth(mes);
      const [yy, mm] = mes.split("-").map(Number);
      periodoLabel = `${MESES_PT[(mm || 1) - 1]} DE ${yy}`;
      isPeriodoMensal = true;
    } else if (data_inicio && data_fim) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data_inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) {
        return json({ error: "data_inicio e data_fim devem ter o formato YYYY-MM-DD." }, 400);
      }
      periodoInicio = data_inicio;
      periodoFimExclusivo = dayAfter(data_fim);
      periodoLabel = `${formatDataPt(data_inicio)} A ${formatDataPt(data_fim)}`;
      isPeriodoMensal = false;
    } else {
      return json({ error: "Indica mes (YYYY-MM) ou data_inicio+data_fim (YYYY-MM-DD)." }, 400);
    }
    const periodoFimInclusivo = new Date(new Date(periodoFimExclusivo + "T00:00:00Z").valueOf() - 86400000).toISOString().slice(0, 10);

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

    // ── Resolver filtro de cliente (opcional) ───────────────────────
    let clientId: string | null = null;
    let clientLabel: string | null = null;
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
      clientId = clientes[0].id;
      clientLabel = clientes[0].name;
    }

    // ── Resolver filtro de trabalhador(es) ──────────────────────────
    // worker_id: um único trabalhador (ignora profissao). profissao: todos os
    // trabalhadores ativos com essa profissão. Nenhum dos dois: todos os
    // trabalhadores que tenham registos no período (e no cliente, se indicado).
    let allowedWorkerIds: string[] | null = null;
    let profissaoLabel: string | null = null;
    if (worker_id) {
      allowedWorkerIds = [worker_id];
    } else if (profissao) {
      const { data: workersProf, error: profErr } = await supabase
        .from("workers")
        .select("id, profissao")
        .ilike("profissao", `%${profissao}%`)
        .eq("is_active", true);
      if (profErr) return json({ error: profErr.message }, 500);
      if (!workersProf || workersProf.length === 0) {
        return json({ error: `Nenhum trabalhador ativo com profissão "${profissao}".` }, 404);
      }
      allowedWorkerIds = workersProf.map((w) => w.id);
      profissaoLabel = workersProf[0].profissao;
    }

    // ── Logs do período (+ filtros de cliente / trabalhadores) ──────
    let logsQuery = supabase
      .from("logs")
      .select("date, startTime, breakStart, breakEnd, endTime, description, hours, clientId, workerId")
      .gte("date", periodoInicio)
      .lt("date", periodoFimExclusivo)
      .order("date", { ascending: true });
    if (clientId) logsQuery = logsQuery.eq("clientId", clientId);
    if (allowedWorkerIds) logsQuery = logsQuery.in("workerId", allowedWorkerIds);

    const { data: logs, error: logsErr } = await logsQuery;
    if (logsErr) return json({ error: logsErr.message }, 500);
    if (!logs || logs.length === 0) {
      return json({ error: `Sem registos de horas para os filtros indicados em ${periodoLabel}.` }, 404);
    }

    const workerIds = [...new Set(logs.map((l) => l.workerId).filter(Boolean))];
    const { data: workersData, error: workersErr } = await supabase
      .from("workers")
      .select("id, name")
      .in("id", workerIds);
    if (workersErr) return json({ error: workersErr.message }, 500);
    const workerNameById = new Map<string, string>();
    for (const w of workersData || []) workerNameById.set(w.id, w.name);

    const clientIds = [...new Set(logs.map((l) => l.clientId).filter(Boolean))];
    const clientNameById = new Map<string, string>();
    if (clientId && clientLabel) {
      clientNameById.set(clientId, clientLabel);
    } else if (clientIds.length > 0) {
      const { data: clientsData } = await supabase.from("clients").select("id, name").in("id", clientIds);
      for (const c of clientsData || []) clientNameById.set(c.id, c.name);
    }

    const workers = workerIds
      .map((wId) => ({
        workerName: workerNameById.get(wId) || wId,
        logs: logs
          .filter((l) => l.workerId === wId)
          .map((l) => ({
            date: l.date, startTime: l.startTime, breakStart: l.breakStart, breakEnd: l.breakEnd,
            endTime: l.endTime, description: l.description, hours: l.hours,
            clientId: l.clientId, clientName: l.clientId ? (clientNameById.get(l.clientId) || "") : "",
          })),
      }))
      .sort((a, b) => a.workerName.localeCompare(b.workerName));

    const { bytes, totalPorTrabalhador } = await generateFolhaPontoPDF({
      dataInicio: periodoInicio,
      dataFim: periodoFimInclusivo,
      periodoLabel,
      isPeriodoMensal,
      workers,
      logoBytes,
    });

    const totalGeral = Object.values(totalPorTrabalhador).reduce((a, b) => a + b, 0);
    const idParts = ["folha-ponto"];
    if (worker_id) idParts.push(worker_id);
    else if (clientId) idParts.push(`cliente_${clientId}`);
    else if (profissao) idParts.push(`profissao_${profissao.replace(/[^a-zA-Z0-9]/g, "_")}`);
    else idParts.push("todos");
    const fileName = `${idParts.join("_")}_${mes || `${data_inicio}_a_${data_fim}`}_${Date.now()}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("documentos")
      .upload(fileName, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadErr) return json({ error: `Erro ao guardar PDF: ${uploadErr.message}` }, 500);

    const { data: urlData } = supabase.storage.from("documentos").getPublicUrl(fileName);

    return json({
      success: true,
      periodo: periodoLabel,
      worker_name: workers.length === 1 ? workers[0].workerName : null,
      client_name: clientLabel,
      profissao: profissaoLabel,
      n_trabalhadores: workers.length,
      total_horas: totalGeral,
      pdf_url: urlData?.publicUrl ?? null,
    });
  } catch (err) {
    console.error("[gerar-folha-ponto] Erro inesperado:", err);
    return json({ error: (err as Error).message ?? "Erro interno." }, 500);
  }
});
