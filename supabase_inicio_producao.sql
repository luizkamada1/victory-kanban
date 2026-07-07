-- Marca o momento em que alguém confirmou que uma OP realmente começou a ser
-- produzida num setor. A partir daí, a previsão de conclusão deixa de ser uma
-- estimativa "a partir de hoje" e passa a ser uma data-alvo CONGELADA no
-- momento do clique (quantidade da OP ÷ capacidade, em dias úteis) — ela não
-- muda mais depois, mesmo que a quantidade da OP ou a capacidade mudem. Isso é
-- o que permite medir depois se a operação entregou antes ou depois do
-- previsto (ver dias_desempenho em historico_transicoes).
-- Independente da tabela producao_ops (que é substituída a cada upload), então
-- sobrevive a novos envios de planilha.
create table if not exists op_inicio_producao (
  setor text not null,
  chave text not null, -- "{op_numero}::{oficina}", mesma convenção da fila_ordem
  data_inicio timestamptz not null,
  previsao_alvo timestamptz, -- data-alvo congelada no momento do início
  created_at timestamptz default now(),
  primary key (setor, chave)
);
