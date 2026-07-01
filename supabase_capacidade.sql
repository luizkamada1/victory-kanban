-- Capacidade produtiva diária por setor (CORTE, ETIQUETAÇÃO, BORDADO, ESTAMPA,
-- COSTURA INTERNA, ACABAMENTO).
create table if not exists capacidade_setores (
  setor text primary key,
  capacidade_diaria integer not null default 0,
  updated_at timestamptz default now()
);

-- Capacidade produtiva diária por oficina externa (Costura Externa).
create table if not exists capacidade_oficinas (
  oficina text primary key,
  capacidade_diaria integer not null default 0,
  updated_at timestamptz default now()
);
