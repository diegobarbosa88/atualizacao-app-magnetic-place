import React from 'react'
import DocumentsAdmin from './DocumentsAdmin'
import { useAdminData } from './context/AdminDataProvider'

export default function AdminDocuments() {
  const {
    workers, documents, setDocuments, systemSettings, supabase,
    reportFilter, setReportFilter, reportHistory, setReportHistory,
    printingReport, setPrintingReport, clients,
    activeWorkersCount, activeClientsCount,
    logs, clientApprovals
  } = useAdminData()

  return (
    <DocumentsAdmin
      workers={workers}
      documents={documents}
      setDocuments={setDocuments}
      systemSettings={systemSettings}
      supabase={supabase}
      reportFilter={reportFilter}
      setReportFilter={setReportFilter}
      reportHistory={reportHistory}
      setReportHistory={setReportHistory}
      printingReport={printingReport}
      setPrintingReport={setPrintingReport}
      clients={clients}
      activeWorkersCount={activeWorkersCount}
      activeClientsCount={activeClientsCount}
      handleGenerateClientReport={() => {}}
      logs={logs}
      clientApprovals={clientApprovals}
    />
  )
}