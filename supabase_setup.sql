create table if not exists producao_ops (
  id bigint generated always as identity primary key,
  op_numero text not null,
  setor text not null,
  codigo text,
  produto text,
  quantidade integer default 0,
  data_envio_fase timestamptz,
  data_op timestamptz,
  data_entrega timestamptz,
  oficina text,
  created_at timestamptz default now()
);

create index if not exists idx_producao_ops_setor on producao_ops (setor);
