
/**
 * Chama a API do Google Gemini para processamento de texto.
 * @param {string} prompt 
 * @param {string} systemInstruction 
 * @param {string} apiKey 
 * @returns {Promise<string>}
 */
export async function callGemini(prompt, systemInstruction = "", apiKey = "") {
  if (!apiKey) return "A IA precisa de uma chave API configurada.";
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };

  try {
    const response = await fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });

    if (response.ok) {
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro na resposta.";
    } else {
      const errorData = await response.json();
      console.error('Gemini API Error:', errorData);
      return `Erro API (${response.status}): ${errorData.error?.message || 'Falha na comunicação'}`;
    }
  } catch (error) { 
    console.error('Gemini Fetch Error:', error);
    return "Ocorreu um erro ao contactar a IA.";
  }
}
