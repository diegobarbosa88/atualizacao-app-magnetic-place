import React from 'react';
import { WorkerProvider } from './contexts/WorkerContext';

const WorkerDashboardContent = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* TODO: Full dashboard implementation in Plan 02 */}
      <p>Worker Dashboard - Loading...</p>
    </div>
  );
};

const WorkerDashboard = () => {
  return (
    <WorkerProvider>
      <WorkerDashboardContent />
    </WorkerProvider>
  );
};

export default WorkerDashboard;
