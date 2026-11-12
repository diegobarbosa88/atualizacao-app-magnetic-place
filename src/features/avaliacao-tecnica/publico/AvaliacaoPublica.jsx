import { useCallback, useEffect, useState } from 'react';
import { CircleCheck, CircleX, Clock, LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import AvaliacaoProva from '../AvaliacaoProva.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ORG_NAME } from '../config.js';
import { Marca } from '../components/Marca.jsx';
import { iniciarProva, obterConvite, submeterProva } from '../api.js';

// Respostas guardadas no aparelho até o servidor confirmar a receção — se a rede
// falhar no fim da prova, reabrir o mesmo link reenvia-as.
const chaveEnvio = (token) => `avaliacao-envio:${token}`;
const guardarEnvio = (token, envio) => {
  try {
    localStorage.setItem(chaveEnvio(token), JSON.stringify(envio));
  } catch {
    /* modo privado / armazenamento cheio — o envio continua a ser tentado */
  }
};
const lerEnvio = (token) => {
  try {
    return JSON.parse(localStorage.getItem(chaveEnvio(token)) || 'null');
  } catch {
    return null;
  }
};
const limparEnvio = (token) => {
  try {
    localStorage.removeItem(chaveEnvio(token));
  } catch {
    /* ignore */
  }
};

const MENSAGENS = {
  invalid: { icon: CircleX, titulo: 'Link inválido', texto: 'Confira se copiou o link inteiro ou peça um novo ao recrutador.' },
  expired: { icon: Clock, titulo: 'Link expirado', texto: 'O prazo para fazer esta prova terminou. Peça um novo link ao recrutador.' },
  cancelled: { icon: CircleX, titulo: 'Link cancelado', texto: 'Esta avaliação foi cancelada pela Magnetic Place.' },
  completed: { icon: CircleCheck, titulo: 'Prova já concluída', texto: 'Suas respostas já foram recebidas. Obrigado!' },
  in_progress: {
    icon: TriangleAlert,
    titulo: 'Prova já iniciada',
    texto: 'Esta prova foi aberta e não terminou (a página foi recarregada ou fechada). Peça ao recrutador para reabrir o link.',
  },
};

/** /avaliacao/:token — página do candidato, fora do AppProvider (ver main.jsx) */
export default function AvaliacaoPublica({ token }) {
  const [estado, setEstado] = useState('loading');
  const [convite, setConvite] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setEstado('loading');
    setErro('');
    try {
      const c = await obterConvite(token);
      if (c.estado === 'completed') limparEnvio(token);
      if (c.estado === 'in_progress' && lerEnvio(token)) {
        setEstado('reenvio');
        return;
      }
      setConvite(c);
      setEstado(c.estado === 'pending' ? 'prova' : c.estado);
    } catch (e) {
      if (e.estado) setEstado(e.estado);
      else {
        setErro(e.message);
        setEstado('erro-rede');
      }
    }
  }, [token]);

  useEffect(() => {
    document.title = `Avaliação técnica · ${ORG_NAME}`;
    carregar();
  }, [carregar]);

  const onStart = useCallback(
    async (dados) => {
      const r = await iniciarProva(token, dados);
      return { seed: r.seed, internalId: r.internalId };
    },
    [token],
  );

  const onSubmit = useCallback(
    async (envio) => {
      guardarEnvio(token, envio);
      await submeterProva(token, envio);
      limparEnvio(token);
    },
    [token],
  );

  if (estado === 'prova') {
    return <AvaliacaoProva level={convite.nivel} inicial={convite.candidato} onStart={onStart} onSubmit={onSubmit} />;
  }

  return (
    <div className="avaliacao-scope min-h-dvh bg-mp-creme text-slate-900">
      <header className="bg-mp-navy-800 text-white">
        <div className="mx-auto max-w-3xl px-4 py-2.5">
          <Marca />
        </div>
        <div className="faixa-marca h-[3px]" aria-hidden />
      </header>

      <main className="mx-auto max-w-xl px-4 pt-10">
        {estado === 'loading' && (
          <div className="flex justify-center pt-10">
            <LoaderCircle className="size-10 animate-spin text-mp-navy-600" aria-label="Carregando" />
          </div>
        )}
        {estado === 'reenvio' && <Reenvio token={token} onDone={() => setEstado('completed')} />}
        {estado === 'erro-rede' && (
          <Mensagem icon={TriangleAlert} titulo="Não foi possível abrir a prova" texto={erro}>
            <Button size="lg" icon={<RotateCcw className="size-5" />} onClick={carregar}>
              Tentar de novo
            </Button>
          </Mensagem>
        )}
        {MENSAGENS[estado] && <Mensagem {...MENSAGENS[estado]} />}
      </main>
    </div>
  );
}

function Mensagem({ icon, titulo, texto, children }) {
  const Icon = icon;
  return (
    <Card className="p-8 text-center">
      <Icon className="mx-auto size-14 text-slate-400" />
      <h1 className="mt-4 text-2xl font-bold">{titulo}</h1>
      <p className="mt-2 text-slate-600">{texto}</p>
      {children && <div className="mt-6 flex justify-center">{children}</div>}
    </Card>
  );
}

/** Prova feita mas não confirmada pelo servidor: reenvia as respostas guardadas */
function Reenvio({ token, onDone }) {
  const [falhou, setFalhou] = useState(false);

  const enviar = useCallback(async () => {
    setFalhou(false);
    try {
      await submeterProva(token, lerEnvio(token));
      limparEnvio(token);
      onDone();
    } catch {
      setFalhou(true);
    }
  }, [token, onDone]);

  useEffect(() => {
    enviar();
  }, [enviar]);

  return falhou ? (
    <Mensagem
      icon={TriangleAlert}
      titulo="Respostas ainda por enviar"
      texto="Sua prova ficou salva neste aparelho, mas não chegou ao servidor. Verifique a internet e tente de novo."
    >
      <Button size="lg" icon={<RotateCcw className="size-5" />} onClick={enviar}>
        Enviar respostas
      </Button>
    </Mensagem>
  ) : (
    <Mensagem icon={LoaderCircle} titulo="Enviando respostas salvas…" texto="Não feche esta página." />
  );
}
