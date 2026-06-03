import React from 'react'
import TeamManager from './TeamManager'
import { useAdminData } from './context/AdminDataProvider'

export default function AdminTeam() {
  const { app } = useAdminData()
  return <TeamManager onLogin={app.handleLogin} />
}