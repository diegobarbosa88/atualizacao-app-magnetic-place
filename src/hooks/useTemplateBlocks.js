import { useState, useCallback, useEffect } from 'react';
import { replaceTemplateFields } from '../utils/templateFields';

export const BLOCK_TYPES = ['title', 'subtitle', 'paragraph', 'signature'];

export const DEFAULT_BLOCK = { type: 'paragraph', content: '', order: 0 };

export function useTemplateBlocks(supabase, { onError } = {}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('name');

      if (error) throw error;

      const templatesWithBlocks = (data || []).map(t => ({
        ...t,
        blocks: typeof t.blocks === 'string' ? JSON.parse(t.blocks) : (t.blocks || [])
      }));

      setTemplates(templatesWithBlocks);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, onError]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const getTemplate = useCallback(async (templateId) => {
    if (!supabase || !templateId) return null;
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      return {
        ...data,
        blocks: typeof data.blocks === 'string' ? JSON.parse(data.blocks) : (data.blocks || [])
      };
    } catch (err) {
      console.error('Erro ao obter template:', err);
      onError?.(err);
      return null;
    }
  }, [supabase, onError]);

  const createTemplate = useCallback(async (name, description, blocks) => {
    if (!supabase) throw new Error('Supabase não configurado');
    if (!name?.trim()) throw new Error('Nome é obrigatório');
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('document_templates')
        .insert([{
          name,
          description: description || '',
          blocks: JSON.stringify(blocks || []),
          created_at: now,
          updated_at: now
        }])
        .select()
        .single();

      if (error) throw error;

      await loadTemplates();
      return data;
    } catch (err) {
      console.error('Erro ao criar template:', err);
      onError?.(err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [supabase, loadTemplates, onError]);

  const updateTemplate = useCallback(async (templateId, name, description, blocks) => {
    if (!supabase) throw new Error('Supabase não configurado');
    if (!templateId) throw new Error('ID do template é obrigatório');
    setSaving(true);
    try {
      const { error } = await supabase
        .from('document_templates')
        .update({
          name,
          description: description || '',
          blocks: JSON.stringify(blocks || []),
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId);

      if (error) throw error;
      await loadTemplates();
    } catch (err) {
      console.error('Erro ao atualizar template:', err);
      onError?.(err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [supabase, loadTemplates, onError]);

  const deleteTemplate = useCallback(async (templateId) => {
    if (!supabase) throw new Error('Supabase não configurado');
    if (!window.confirm('Apagar este template permanentemente?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      await loadTemplates();
    } catch (err) {
      console.error('Erro ao apagar template:', err);
      onError?.(err);
    } finally {
      setSaving(false);
    }
  }, [supabase, loadTemplates, onError]);

  return {
    templates,
    loading,
    saving,
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate
  };
}
