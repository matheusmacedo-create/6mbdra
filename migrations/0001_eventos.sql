-- Métricas de uso do brpdf. Nada aqui identifica uma pessoa ou um documento:
-- só contagens, categorias e um identificador de visitante que muda todo dia.
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,          -- quando o servidor recebeu (epoch ms)
  dia TEXT NOT NULL,            -- AAAA-MM-DD no fuso de São Paulo
  visitante TEXT NOT NULL,      -- hash diário e salgado; não volta a ser IP nem segue a pessoa entre dias
  nome TEXT NOT NULL,           -- ver EVENTOS em src/worker/index.ts (acesso, arquivo_analisado, lote_concluido, erro…)
  caminho TEXT,                 -- página visitada (só caminho, sem parâmetros)
  origem TEXT,                  -- domínio de quem indicou (sem caminho)
  pais TEXT,
  dispositivo TEXT,             -- celular | computador
  tribunal TEXT,
  sistema TEXT,
  situacao TEXT,                -- otimizado | dividido | acima_do_limite | ok | senha | pronto…
  categoria TEXT,               -- código do erro
  faixa TEXT,                   -- faixa de tamanho do arquivo
  tipo TEXT,                    -- subtipo do evento (zip, parte, cinza, dividir…)
  quantidade INTEGER,
  nivel INTEGER,
  partes INTEGER,
  segundos INTEGER,
  paginas INTEGER,
  meta_mb REAL
);
CREATE INDEX IF NOT EXISTS idx_eventos_dia ON eventos (dia);
CREATE INDEX IF NOT EXISTS idx_eventos_nome_dia ON eventos (nome, dia);
CREATE INDEX IF NOT EXISTS idx_eventos_ts ON eventos (ts);
