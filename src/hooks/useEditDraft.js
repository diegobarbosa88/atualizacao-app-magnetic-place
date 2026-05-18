import { useState, useCallback } from 'react';

/**
 * Hook to manage temporary edits (drafts) for report corrections.
 */
export const useEditDraft = (initialData = null) => {
  const [draft, setDraft] = useState(initialData);

  const startEdit = useCallback((data) => {
    // Deep clone to ensure originalData is preserved independently
    const cloned = JSON.parse(JSON.stringify(data));
    setDraft({ ...cloned, originalData: cloned });
  }, []);

  const updateField = useCallback((field, value) => {
    setDraft(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value
      };
    });
  }, []);

  const updateNestedField = useCallback((path, value) => {
    setDraft(prev => {
      if (!prev) return null;
      const newDraft = JSON.parse(JSON.stringify(prev));
      let current = newDraft;
      const keys = path.split('.');
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newDraft;
    });
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const isDirty = useCallback(() => {
    if (!draft || !draft.originalData) return false;
    const current = { ...draft };
    delete current.originalData;
    return JSON.stringify(current) !== JSON.stringify(draft.originalData);
  }, [draft]);

  return {
    draft,
    startEdit,
    updateField,
    updateNestedField,
    clearDraft,
    isDirty
  };
};
