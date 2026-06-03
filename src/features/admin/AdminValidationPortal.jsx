import React from 'react'
import ValidationPortal from './ValidationPortal'
import { ValidationPortalProvider } from './contexts/ValidationPortalContext'
import { useAdminData } from './context/AdminDataProvider'

export default function AdminValidationPortal() {
  const {
    portalSubTab, setPortalSubTab,
    portalMonth, setPortalMonth,
    selectedCorrectionId, setSelectedCorrectionId,
    app
  } = useAdminData()

  return (
    <ValidationPortalProvider
      portalSubTab={portalSubTab}
      setPortalSubTab={setPortalSubTab}
      portalMonth={portalMonth}
      setPortalMonth={setPortalMonth}
    >
      <ValidationPortal
        onLogin={app.handleLogin}
        setClienteSelecionado={app.setClienteSelecionado || (() => {})}
        setModalEmailAberto={app.setModalEmailAberto || (() => {})}
        setPrintingReport={() => {}}
        initialCorrectionId={selectedCorrectionId}
        onCorrectionNavigated={() => setSelectedCorrectionId(null)}
      />
    </ValidationPortalProvider>
  )
}