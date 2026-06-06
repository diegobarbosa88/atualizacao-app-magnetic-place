import React, { createContext, useContext, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toISODateLocal } from '../../../utils/dateUtils';

const ValidationPortalContext = createContext();

export const ValidationPortalProvider = ({ children, portalMonth, setPortalMonth }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const portalSubTab = location.pathname.split('/')[3] || 'envios';
  const setPortalSubTab = (tab) => navigate('/admin/portal_validacao/' + tab);

  const [portalWorkersSort, setPortalWorkersSort] = useState({ key: 'name', direction: 'asc' });
  const [valSortConfig, setValSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [clientPortalLinkFilter, setClientPortalLinkFilter] = useState({
    clientId: '',
    month: toISODateLocal(new Date()).substring(0, 7)
  });

  const portalMonthStr = toISODateLocal(portalMonth).substring(0, 7);

  const value = {
    portalSubTab, setPortalSubTab,
    portalWorkersSort, setPortalWorkersSort,
    valSortConfig, setValSortConfig,
    clientPortalLinkFilter, setClientPortalLinkFilter,
    portalMonth, setPortalMonth,
    portalMonthStr
  };

  return (
    <ValidationPortalContext.Provider value={value}>
      {children}
    </ValidationPortalContext.Provider>
  );
};

export const useValidationPortal = () => {
  const context = useContext(ValidationPortalContext);
  if (!context) throw new Error('useValidationPortal must be used within a ValidationPortalProvider');
  return context;
};

export default ValidationPortalContext;
