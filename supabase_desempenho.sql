-- Adiciona o registro de "entregou antes ou depois do previsto" às transições
-- já existentes. Só é preenchido quando a OP tinha sido marcada como
-- "Iniciada" (op_inicio_producao) naquele setor antes de sair dele.
-- dias_desempenho: positivo = dias de atraso (saiu depois da previsão-alvo),
-- negativo = dias de adiantamento (saiu antes), 0 = saiu exatamente no dia
-- previsto, null = não havia previsão-alvo registrada (OP nunca foi marcada
-- como iniciada nesse setor).
alter table historico_transicoes add column if not exists dias_desempenho integer;
