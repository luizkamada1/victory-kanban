-- Histórico diário agregado por setor, usado nos gráficos de evolução do
-- dashboard. Uma linha por (data, setor), atualizada a cada upload de planilha
-- com o estado daquele dia (se já existir uma linha para o mesmo dia, ela é
-- sobrescrita — não acumula duplicatas quando há mais de um upload no dia).
create table if not exists historico_diario (
  data date not null,
  setor text not null,
  total_ops integer not null default 0,
  total_pecas integer not null default 0,
  created_at timestamptz default now(),
  primary key (data, setor)
);
