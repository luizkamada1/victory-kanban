-- Marca o momento em que alguém confirmou que uma OP realmente começou a ser
-- produzida num setor. A partir daí, a previsão de conclusão deixa de ser uma
-- estimativa "a partir de hoje" e passa a ser ancorada nessa data — podendo
-- ficar atrasada de verdade se o prazo passar e a OP ainda não tiver saído do
-- setor. Independente da tabela producao_ops (que é substituída a cada
-- upload), então sobrevive a novos envios de planilha.
create table if not exists op_inicio_producao (
  setor text not null,
  chave text not null, -- "{op_numero}::{oficina}", mesma convenção da fila_ordem
  data_inicio timestamptz not null,
  created_at timestamptz default now(),
  primary key (setor, chave)
);
