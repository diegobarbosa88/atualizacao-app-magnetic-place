-- Relay automático das notificações do admin para WhatsApp.
--
-- Sempre que uma notificação dirigida ao admin (target_type = 'admin') é
-- criada em app_notifications -- pelos 7 sítios que já chamam notifyEvent()
-- com target: TARGET.ADMIN (assinatura de documento, pedidos de
-- trabalhador, submissão de onboarding, dashboard/perfil, correções) --
-- este trigger dispara automaticamente uma chamada HTTP assíncrona
-- (net.http_post, extensão pg_net) para api/whatsapp?action=notificar-admin
-- em app-magnetic, que manda o template já aprovado
-- WHATSAPP_TEMPLATE_AVISO_BOTAO a todos os WHATSAPP_NUMEROS_AUTORIZADOS.
--
-- Decisão do Diego: substitui o Job A (verificar-urgentes, polling a cada
-- 30 min no repo conselheiro) -- este trigger cobre mais tipos de evento
-- e dispara na hora, sem esperar pelo próximo ciclo. Ver
-- .github/workflows/verificar-urgentes.yml (conselheiro) para o desligar.
--
-- O segredo aqui embutido é o mesmo gravado como ADMIN_NOTIF_WEBHOOK_SECRET
-- na Vercel (projeto app-magnetic) -- só assim o endpoint aceita a chamada,
-- já que não vem de uma sessão de admin autenticada (o trigger dispara
-- também para eventos originados por trabalhadores ou pela página pública
-- de onboarding, sem sessão admin nenhuma).

create extension if not exists pg_net;

create or replace function public.notificar_admin_whatsapp()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.target_type = 'admin' then
    perform net.http_post(
      url := 'https://app-magnetic.vercel.app/api/whatsapp',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', 'a9f8e909010adcccfbcec13e52ff44960a41afe3f6fdc4d8b91aa76a2b10d5a0'
      ),
      body := jsonb_build_object(
        'action', 'notificar-admin',
        'title', new.title,
        'message', new.message
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notificar_admin_whatsapp on app_notifications;
create trigger trg_notificar_admin_whatsapp
  after insert on app_notifications
  for each row
  execute function public.notificar_admin_whatsapp();
