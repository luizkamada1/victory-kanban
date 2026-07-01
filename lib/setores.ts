// Ordem oficial das colunas do kanban.
// O nome aqui precisa bater com o valor da coluna "Fase.1" do Excel do ERP — com
// exceção de "COSTURA", que é dividida automaticamente em COSTURA INTERNA / COSTURA
// EXTERNA no processamento do upload, com base na coluna "Oficina".
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
  "COSTURA INTERNA",
  "COSTURA EXTERNA",
  "RET. COSTURA",
  "ACABAMENTO",
  "ESTOQUE",
] as const;

export type Setor = (typeof SETORES_ORDEM)[number];

// Setor(es) em que o card também mostra a Oficina/facção
export const SETORES_COM_OFICINA: string[] = ["COSTURA EXTERNA"];

// Setores que têm capacidade produtiva diária configurável (tela /capacidade).
// COSTURA EXTERNA não entra aqui: a capacidade dela é configurada por oficina.
export const SETORES_COM_CAPACIDADE = [
  "CORTE",
  "ETIQUETAÇÃO",
  "BORDADO",
  "ESTAMPA",
  "COSTURA INTERNA",
  "ACABAMENTO",
] as const;
