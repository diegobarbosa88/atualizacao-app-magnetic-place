import { useState, useCallback } from 'react'
import { callGemini } from '../../../utils/aiUtils'

export function useWorkerAudit() {
  const [workerAISummary, setWorkerAISummary] = useState('')
  const [isSummarizing, setIsSummarizing] = useState(false)

  const generateWorkerSummary = useCallback(async (auditedWorker, auditedMonthLogs, currentMonth) => {
    if (!auditedMonthLogs || auditedMonthLogs.length === 0) return
    setIsSummarizing(true)
    const logTexts = auditedMonthLogs.map(l => `- ${l.date}: ${l.description}`).join('\n')
    const prompt = `Resuma o desempenho de ${auditedWorker.name} baseado nestas atividades de ${currentMonth.toLocaleDateString('pt-PT', { month: 'long' })}: \n${logTexts}\n Destaque produtividade e áreas de foco de forma executiva.`
    const summary = await callGemini(prompt, 'Você é um gestor de RH analítico.')
    setWorkerAISummary(summary)
    setIsSummarizing(false)
  }, [])

  return {
    workerAISummary,
    setWorkerAISummary,
    isSummarizing,
    generateWorkerSummary
  }
}