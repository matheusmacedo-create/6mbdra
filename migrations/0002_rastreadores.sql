-- Visitas de rastreador (Googlebot e afins), contadas pelo Worker.
--
-- O painel de uso é alimentado por JavaScript no navegador, e rastreador não roda JavaScript:
-- por isso nenhuma passada do Google aparece lá. Como agora o Worker vê todas as requisições,
-- dá para contá-las no servidor — e essa é a evidência de rastreamento que chega ANTES de o
-- Search Console reportar qualquer coisa.
--
-- Contador agregado, não log: a chave é (dia, bot, tipo de página), então o número de linhas é
-- limitado por mais que o site cresça em tráfego.
CREATE TABLE IF NOT EXISTS rastreadores (
  dia TEXT NOT NULL,          -- AAAA-MM-DD no fuso de São Paulo
  bot TEXT NOT NULL,          -- googlebot | bingbot | ...
  tipo TEXT NOT NULL,         -- home | tribunal | sistema | guia | tarefa | institucional | outro
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, bot, tipo)
);
CREATE INDEX IF NOT EXISTS idx_rastreadores_dia ON rastreadores (dia);
