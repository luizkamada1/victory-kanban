-- Ordem manual da fila de OPs dentro de cada setor. Independente da tabela
-- producao_ops (que é substituída a cada upload), então a prioridade definida
-- pelo usuário sobrevive a novos uploads. "chave" identifica o card de forma
-- estável entre uploads: "{op_numero}::{oficina ou vazio}".
create table if not exists fila_ordem (
  setor text not null,
  chave text not null,
  posicao integer not null,
  updated_at timestamptz default now(),
  primary key (setor, chave)
);
