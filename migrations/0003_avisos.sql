-- Avisos de mudança de regra.
--
-- É o PRIMEIRO dado pessoal que este projeto guarda, e a decisão não foi tomada de leve: o site
-- promete "sem cadastro" em 116 páginas e a política de privacidade dizia "não coletamos dados
-- pessoais". As duas coisas foram ajustadas junto com esta tabela — promessa que vira mentira em
-- silêncio é pior que promessa nunca feita.
--
-- O que justifica a exceção: o projeto já roda um monitor semanal das fontes oficiais
-- (scripts/check-sources.mjs + .github/workflows/rules-monitor.yml) que detecta quando um tribunal
-- muda o limite. Avisar quem se inscreveu é o único uso que essa infraestrutura permite e que
-- ninguém mais pode oferecer — e é uma troca honesta: um e-mail por um aviso que evita peça
-- recusada.
--
-- LGPD, na prática:
--   - finalidade única e declarada na hora do consentimento (art. 9º);
--   - consentimento registrado com data, origem e texto aceito — não basta ter o e-mail;
--   - confirmado_em fica nulo até a pessoa confirmar por e-mail (dupla confirmação);
--   - cancelado_em preserva a linha, para honrar o descadastro sem perder a prova de consentimento;
--   - nenhum dado além do e-mail e do que a pessoa escolheu acompanhar.
CREATE TABLE IF NOT EXISTS avisos (
  email TEXT NOT NULL,             -- guardado em minúsculas, sem espaços
  regra TEXT NOT NULL,             -- id da regra acompanhada; 'todas' para o site inteiro
  criado_em TEXT NOT NULL,         -- ISO 8601 UTC
  origem TEXT,                     -- de qual página veio (tribunal, ferramenta…)
  consentimento TEXT NOT NULL,     -- o texto exato que a pessoa aceitou, para prova
  token TEXT NOT NULL,             -- confirmação e descadastro, aleatório
  confirmado_em TEXT,              -- nulo até a dupla confirmação
  cancelado_em TEXT,               -- nulo enquanto ativo
  PRIMARY KEY (email, regra)
);
CREATE INDEX IF NOT EXISTS idx_avisos_regra ON avisos (regra) WHERE cancelado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_avisos_token ON avisos (token);
