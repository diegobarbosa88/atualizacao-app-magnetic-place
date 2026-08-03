
/**
 * Chama a API do Google Gemini com suporte a imagem/PDF (multimodal).
 * @param {string} base64data - Conteúdo do ficheiro em base64 (sem prefixo data URL)
 * @param {string} mimeType - MIME type (ex: "image/jpeg", "application/pdf")
 * @param {string} systemInstruction
 * @param {string} apiKey
 * @returns {Promise<string>}
 */
export async function callGeminiVision(base64data, mimeType, systemInstruction = "", apiKey = "") {
  if (!apiKey) return "A IA precisa de uma chave API configurada.";

  const model = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64data } },
        { text: 'Analisa este documento e responde EXCLUSIVAMENTE em JSON válido.' }
      ]
    }],
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro na resposta.";
    } else {
      const errorData = await response.json();
      console.error('Gemini Vision API Error:', JSON.stringify(errorData));
      return `Erro API (${response.status}): ${errorData.error?.message || 'Falha na comunicação'}`;
    }
  } catch (error) {
    console.error('Gemini Vision Fetch Error:', error);
    return "Ocorreu um erro ao contactar a IA.";
  }
}

/**
 * Chama a API do Google Gemini para processamento de texto.
 * @param {string} prompt
 * @param {string} systemInstruction
 * @param {string} apiKey
 * @returns {Promise<string>}
 */
export async function callGemini(prompt, systemInstruction = "", apiKey = "") {
  if (!apiKey) return "A IA precisa de uma chave API configurada.";

  const model = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro na resposta.";
    } else {
      const errorData = await response.json();
      console.error('Gemini API Error:', JSON.stringify(errorData));
      return `Erro API (${response.status}): ${errorData.error?.message || 'Falha na comunicação'}`;
    }
  } catch (error) {
    console.error('Gemini Fetch Error:', error);
    return "Ocorreu um erro ao contactar a IA.";
  }
}
