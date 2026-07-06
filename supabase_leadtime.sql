-- Histórico de transições: registra quando uma OP sai de um setor (avançou pra
-- outro setor, ou concluiu e saiu do processo de vez). É construído comparando
-- o snapshot anterior com o novo a cada upload, então só existem transições a
-- partir do momento em que essa funcionalidade entrou no ar (não retroage).
create table if not exists historico_transicoes (
  id bigint generated always as identity primary key,
  op_numero text not null,
  setor text not null,
  oficina text,
  quantidade integer not null default 0,
  data_entrada timestamptz,
  data_saida date not null,
  dias_uteis integer not null default 0,
  tipo text not null, -- 'avancou' (foi pra outro setor) | 'concluiu' (saiu do processo)
  created_at timestamptz default now()
);

create index if not exists idx_historico_transicoes_setor on historico_transicoes (setor);
create index if not exists idx_historico_transicoes_op on historico_transicoes (op_numero);
