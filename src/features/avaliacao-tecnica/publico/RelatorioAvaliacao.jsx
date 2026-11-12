import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, TriangleAlert } from 'lucide-react';
import '../avaliacao-print.css';
import { obterAvaliacao } from '../api.js';
import { Card } from '../components/ui/Card.jsx';
import { reportFromRecord } from '../lib/grading.js';
import { RelatorioView } from '../screens/RelatorioView.jsx';

/**
 * /avaliacao-relatorio/:id — relatório de uma avaliação concluída.
 *
 * Página própria (fora do AppProvider e do App.css, ver main.jsx), aberta num
 * iframe a partir de Equipa › Avaliações: fica sempre com o aspeto de documento
 * (as regras-ponte do modo escuro não a alcançam) e "Imprimir / PDF" imprime só
 * o relatório. Usa o token de sessão do admin guardado no mesmo browser.
 */
export default function RelatorioAvaliacao({ id }) {
  const [avaliacao, setAvaliacao] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    document.title = 'Relatório da avaliação técnica';
    obterAvaliacao(id)
      .then(setAvaliacao)
      .catch((e) => setErro(e.status === 401 || e.status === 403 ? 'É preciso estar autenticado como administrador.' : e.message));
  }, [id]);

  const relatorio = useMemo(() => (avaliacao?.resultado ? reportFromRecord(avaliacao.resultado) : null), [avaliacao]);

  return (
    <div className="min-h-dvh bg-slate-100 px-3 py-5 text-slate-900 sm:px-6 print:bg-white print:p-0">
      {!avaliacao && !erro && (
        <div className="flex justify-center pt-16">
          <LoaderCircle className="size-10 animate-spin text-tech-600" aria-label="A carregar" />
        </div>
      )}
      {(erro || (avaliacao && !relatorio)) && (
        <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
          <TriangleAlert className="mx-auto size-12 text-slate-400" />
          <p className="mt-3 font-semibold">{erro || 'Esta avaliação ainda não tem resultado.'}</p>
        </Card>
      )}
      {relatorio && (
        <RelatorioView
          snapshot={relatorio.snapshot}
          summary={relatorio.summary}
          contacto={[
            { label: 'Telefone', value: avaliacao.candidato_telefone },
            { label: 'E-mail', value: avaliacao.candidato_email },
            { label: 'Experiência declarada', value: avaliacao.candidato_experiencia },
            { label: 'Localidade', value: avaliacao.candidato_localidade },
            { label: 'Vaga / obra', value: avaliacao.vaga },
          ]}
        />
      )}
    </div>
  );
}
