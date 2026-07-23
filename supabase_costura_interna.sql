-- Suporte à tela exclusiva da Costura Interna: capacidade diária de cada
-- célula, e o registro de produção alocada a cada célula (permite que uma
-- mesma OP seja produzida simultaneamente por células diferentes).
create table if not exists capacidade_celulas (
  celula text primary key,
  capacidade_diaria integer not null default 0,
  updated_at timestamptz default now()
);

-- status: 'em_andamento' (aguardando conclusão manual) | 'concluido'
-- tipo_peca: array de texto, ex: '{blusa}' ou '{blusa,shorts_calca}'
-- previsao_alvo: congelada no momento em que a produção foi iniciada nessa
-- célula (quantidade ÷ capacidade da célula, em dias úteis) — mesma lógica
-- usada no Kanban principal, mas por célula.
create table if not exists producao_celulas (
  id bigint generated always as identity primary key,
  op_numero text not null,
  codigo text,
  produto text,
  celula text not null,
  tipo_peca text[] not null default '{}',
  quantidade integer not null,
  data_inicio timestamptz not null default now(),
  previsao_alvo timestamptz,
  status text not null default 'em_andamento',
  quantidade_concluida integer not null default 0,
  data_conclusao timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_producao_celulas_op on producao_celulas (op_numero);
create index if not exists idx_producao_celulas_status on producao_celulas (status);
