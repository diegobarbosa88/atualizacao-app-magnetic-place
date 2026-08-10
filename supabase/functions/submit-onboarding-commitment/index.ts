import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { generateCommitmentPDF } from "./pdfGenerator.ts";

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
    // ── Parse e validação do body ────────────────────────────────
    let body: Record<string, string>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body JSON inválido." }, 400);
    }

    const { invite_id, nome, documento, assinatura_base64, texto_hash, texto_versao, user_agent, email } = body;

    if (!invite_id || !nome?.trim() || !assinatura_base64 || !texto_hash) {
      return json({ error: "Campos obrigatórios em falta: invite_id, nome, assinatura_base64, texto_hash." }, 400);
    }
    if (!assinatura_base64.startsWith("data:image/")) {
      return json({ error: "Formato de assinatura inválido." }, 400);
    }
    if (nome.trim().length < 2 || nome.trim().length > 200) {
      return json({ error: "Nome inválido." }, 400);
    }

    // ── IP do cliente ────────────────────────────────────────────
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";

    // ── Supabase com service role (bypassa RLS) ──────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── Verificar convite ────────────────────────────────────────
    const { data: invite } = await supabase
      .from("worker_onboarding_invites")
      .select("id, status, expires_at")
      .eq("id", invite_id)
      .eq("status", "pending")
      .maybeSingle();

    if (!invite || new Date(invite.expires_at) < new Date()) {
      return json({ error: "Convite inválido ou expirado." }, 400);
    }

    // ── Gravar compromisso ───────────────────────────────────────
    const commitmentId = "obc_" + Date.now();
    const createdAt    = new Date().toISOString();

    const { error: insertErr } = await supabase.from("onboarding_commitments").insert({
      id:               commitmentId,
      invite_id,
      nome:             nome.trim().substring(0, 200),
      documento_id:     (documento ?? "").substring(0, 50) || null,
      assinatura_base64,
      texto_hash,
      texto_versao:     (texto_versao ?? "v1.0").substring(0, 20),
      ip:               ip.substring(0, 50),
      user_agent:       (user_agent ?? "").substring(0, 300),
      created_at:       createdAt,
    });

    if (insertErr) {
      console.error("[commitment] Insert error:", insertErr);
      return json({ error: "Erro ao gravar compromisso na base de dados." }, 500);
    }

    // ── Gerar PDF e fazer upload (não fatal) ─────────────────────
    let pdfUrl: string | null = null;
    try {
      const pdfBytes = await generateCommitmentPDF({
        nome:             nome.trim(),
        documentoId:      documento ?? "N/D",
        assinaturaBase64: assinatura_base64,
        textoHash:        texto_hash,
        textoVersao:      texto_versao ?? "v1.0",
        ip,
        createdAt,
      });

      const fileName = `${commitmentId}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from("onboarding-commitments")
        .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: false });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from("onboarding-commitments")
          .getPublicUrl(fileName);

        pdfUrl = urlData?.publicUrl ?? null;

        await supabase
          .from("onboarding_commitments")
          .update({ pdf_url: pdfUrl })
          .eq("id", commitmentId);
      } else {
        console.error("[commitment] Storage upload error:", uploadErr);
      }
    } catch (pdfErr) {
      console.error("[commitment] PDF generation error:", pdfErr);
      // Não fatal — compromisso já gravado, PDF falhou
    }

    // ── Enviar email via Resend (não fatal) ──────────────────────
    // Configuração: adicionar secret no Supabase → npx supabase secrets set RESEND_API_KEY=re_xxx
    // O "from" domain deve estar verificado no painel Resend.
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && email?.includes("@")) {
      try {
        const emailBody = pdfUrl
          ? `<p>Olá <strong>${nome.trim()}</strong>,</p>
             <p>Obrigado por assinar o <strong>Compromisso de Início de Atividade</strong> com a Magnetic Place.</p>
             <p>Pode descarregar o seu comprovativo em PDF aqui:<br>
             <a href="${pdfUrl}" target="_blank">Descarregar comprovativo (PDF)</a></p>
             <p style="color:#666;font-size:12px;">
               Assinatura registada em ${new Date(createdAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}.<br>
               Este email é gerado automaticamente — não responda.
             </p>
             <br><p>Magnetic Place Unipessoal, Lda</p>`
          : `<p>Olá <strong>${nome.trim()}</strong>,</p>
             <p>Obrigado por assinar o <strong>Compromisso de Início de Atividade</strong> com a Magnetic Place.</p>
             <p>A sua assinatura foi registada em ${new Date(createdAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}.</p>
             <br><p>Magnetic Place Unipessoal, Lda</p>`;

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from:    "Magnetic Place <noreply@magneticplace.pt>",
            to:      [email],
            subject: "Comprovativo — Compromisso de Início de Atividade",
            html:    emailBody,
          }),
        });

        if (!resendRes.ok) {
          const resendErr = await resendRes.text();
          console.error("[commitment] Resend error:", resendErr);
        }
      } catch (emailErr) {
        console.error("[commitment] Email send error:", emailErr);
        // Não fatal
      }
    } else if (!resendKey) {
      console.warn("[commitment] RESEND_API_KEY não configurado — email não enviado. " +
        "Para ativar: npx supabase secrets set RESEND_API_KEY=re_xxx");
    }

    return json({ success: true, commitment_id: commitmentId, pdf_url: pdfUrl });

  } catch (err) {
    console.error("[commitment] Erro inesperado:", err);
    return json({ error: (err as Error).message ?? "Erro interno." }, 500);
  }
});
