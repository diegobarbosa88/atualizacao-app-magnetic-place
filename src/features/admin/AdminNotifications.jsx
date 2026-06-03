import React from 'react'
import NotificationsAdmin from './NotificationsAdmin'
import { useAdminData } from './context/AdminDataProvider'

export default function AdminNotifications() {
  const { workers, appNotifications, saveToDb, handleDelete, supabase } = useAdminData()
  return (
    <NotificationsAdmin
      workers={workers}
      appNotifications={appNotifications}
      saveToDb={saveToDb}
      handleDelete={handleDelete}
      supabase={supabase}
    />
  )
}