-- Campos adicionais PSI v2 — obrigatórios para comunicar admissão via REST/JSON
-- (Serviço QLF-O1051: POST /ptss/rest/qlf/tco/vinculos/pedido)
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS data_nascimento  DATE,
  ADD COLUMN IF NOT EXISTS enquadramento    TEXT    DEFAULT 'REGE',
  ADD COLUMN IF NOT EXISTS local_trabalho   INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS profissao_cnp    TEXT;
-- data_nascimento : data de nascimento do trabalhador (obrigatório pela PSI REST)
-- enquadramento   : código PSI de enquadramento contributivo (ex: REGE = Regime Geral)
-- local_trabalho  : código PSI do estabelecimento de trabalho (inteiro, obtido na SSD)
-- profissao_cnp   : código CNP a 5 dígitos sem ponto (ex: 93130), distinto do campo
--                   profissao que é texto livre para uso interno
