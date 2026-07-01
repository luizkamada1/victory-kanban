// Ordem oficial das colunas do kanban.
// O nome aqui precisa bater exatamente com o valor da coluna "Fase.1" do Excel do ERP.
export const SETORES_ORDEM = [
  "CORTE",
  "RET. CORTE",
  "ETIQUETAÇÃO",
  "BORDADO",
  "RET. BORDADO",
  "ESTAMPA",
  "RET. ESTAMPA",
  "UNIÃO DE PARTES",
  "EMBALAGEM",
  "COSTURA",
  "RET. COSTURA",
  "ACABAMENTO",
  "ESTOQUE",
] as const;

export type Setor = (typeof SETORES_ORDEM)[number];

// Setor(es) em que o card também mostra a Oficina/facção
export const SETORES_COM_OFICINA: string[] = ["COSTURA"];
