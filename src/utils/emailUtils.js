
import emailjs from '@emailjs/browser';

export const EMAILJS_SERVICE_ID = "service_xvt0vm8";
export const EMAILJS_TEMPLATE_ID_NOTIF = "template_xmexrgp";
export const EMAILJS_PUBLIC_KEY = "SzlA6KKCD4miw0CR9";

const emailTranslations = {
  es: {
    'Pedido de Correção': 'Solicitud de Corrección',
    'Divergência Reportada': 'Divergencia Reportada',
    'Correção Aceite': 'Corrección Aceptada',
    'Correção Rejeitada': 'Corrección Rechazada',
    'Mensagem de Divergência': 'Mensaje de Divergencia',
    'PEDIDO DE CORREÇÃO': 'SOLICITUD DE CORRECCIÓN',
    'MENSAGEM DE DIVERGÊNCIA': 'MENSAJE DE DIVERGENCIA',
    'RESUMO GERAL': 'RESUMEN GENERAL',
    'Total Original:': 'Total Original:',
    'Novo Total Sugerido:': 'Nuevo Total Sugerido:',
    'Diferença:': 'Diferencia:',
    'DETALHES POR COLABORADOR': 'DETALLES POR COLABORADOR',
    'Total:': 'Total:',
    'Alterações:': 'Cambios:',
    'Turno:': 'Turno:',
    'Pausa:': 'Pausa:',
    'Horas:': 'Horas:',
    'JUSTIFICAÇÃO:': 'JUSTIFICACIÓN:',
    'justificação:': 'justificación:',
    'Correção aceite pelo admin!': '¡Corrección aceptada por el admin!',
    'Correção rejeitada. Motivo:': 'Corrección rechazada. Motivo:',
  }
};

/**
 * Traduz o conteúdo do e-mail baseado no idioma.
 * @param {string} text 
 * @param {string} lang 
 * @returns {string}
 */
export const translateEmailContent = (text, lang = 'es') => {
  if (!text || !emailTranslations[lang]) return text;
  let translated = text;
  const replacements = emailTranslations[lang];
  const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  keys.forEach(key => {
    translated = translated.split(key).join(replacements[key]);
  });
  return translated;
};

/**
 * Converte strings de mês para formato YYYY-MM.
 * @param {string} monthStr 
 * @returns {string}
 */
const monthToYYYYMM = (monthStr) => {
  if (!monthStr) return null;
  if (monthStr.match(/^\d{4}-\d{2}$/)) return monthStr;
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const lower = monthStr.toLowerCase();
  const monthIdx = months.findIndex(m => lower.includes(m));
  const yearMatch = monthStr.match(/\d{4}/);
  if (monthIdx >= 0 && yearMatch) {
    return `${yearMatch[0]}-${String(monthIdx + 1).padStart(2, '0')}`;
  }
  return monthStr;
};

/**
 * Envia e-mail de notificação via EmailJS.
 * @param {string} clientEmail 
 * @param {string} clientName 
 * @param {string} notifTitle 
 * @param {string} notifMessage 
 * @param {string} clientId 
 * @param {string} month 
 * @param {string} portalUrl 
 * @returns {Promise<boolean>}
 */
export const sendNotificationEmail = async (clientEmail, clientName, notifTitle, notifMessage, clientId = null, month = null, portalUrl = 'http://localhost:5173') => {
  try {
    const monthStr = month ? monthToYYYYMM(month) : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const clientParam = clientId ? `&client=${String(clientId)}&month=${monthStr}` : '';
    const translatedTitle = translateEmailContent(notifTitle, 'es');
    const translatedMessage = translateEmailContent(notifMessage, 'es');
    
    const templateParams = {
      to_email: clientEmail || 'contato@cliente.pt',
      to_name: clientName,
      notification_title: translatedTitle,
      notification_message: translatedMessage,
      link_unico: `${portalUrl}/?view=client_portal${clientParam}`
    };

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID_NOTIF, templateParams, EMAILJS_PUBLIC_KEY);
    return true;
  } catch (error) {
    console.error('Falha no envio de e-mail de notificação:', error);
    return false;
  }
};
