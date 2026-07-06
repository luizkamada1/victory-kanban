import type { OP } from "./types";

// Conta só dias úteis (segunda a sexta) entre duas datas — sábado e domingo
// não contam. Não considera feriados.
export function diasUteisEntre(inicio: Date | string | null, fim: Date | string): number {
  if (!inicio) return 0;
  const dataInicio = new Date(inicio);
  dataInicio.setHours(0, 0, 0, 0);
  const dataFim = new Date(fim);
  dataFim.setHours(0, 0, 0, 0);
  if (dataFim <= dataInicio) return 0;

  let dias = 0;
  const cursor = new Date(dataInicio);
  while (cursor < dataFim) {
    cursor.setDate(cursor.getDate() + 1);
    const diaSemana = cursor.getDay(); // 0 = domingo, 6 = sábado
    if (diaSemana !== 0 && diaSemana !== 6) dias++;
  }
  return dias;
}

// Conta dias úteis entre duas datas INCLUINDO os dois extremos — usado pra
// saber quantos dias de capacidade produtiva existem num período (ex: "este
// mês" tem N dias úteis, cada um vale a capacidade diária configurada).
export function diasUteisNoPeriodo(inicio: string, fim: string): number {
  const dataInicio = new Date(inicio);
  dataInicio.setHours(0, 0, 0, 0);
  const dataFim = new Date(fim);
  dataFim.setHours(0, 0, 0, 0);
  if (dataFim < dataInicio) return 0;

  let dias = 0;
  const cursor = new Date(dataInicio);
  while (cursor <= dataFim) {
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export function diasNoSetor(dataEnvioFase: string | null): number | null {
  if (!dataEnvioFase) return null;
  return diasUteisEntre(dataEnvioFase, new Date());
}

export function corAlerta(dias: number | null): string {
  if (dias === null) return "#9ca3af";
  if (dias >= 7) return "#dc2626";
  if (dias >= 3) return "#d97706";
  return "#16a34a";
}

export function corOcupacao(percentual: number | null): string {
  if (percentual === null) return "#9ca3af";
  if (percentual >= 100) return "#dc2626";
  if (percentual >= 80) return "#d97706";
  return "#16a34a";
}

export function normaliza(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function abreviaOficina(nome: string): string {
  return nome.replace(/^OFICINA EXTERNA\s+/i, "O.E. ");
}

// Identifica um card de forma estável entre uploads (a tabela producao_ops é
// substituída a cada envio de planilha, então não dá pra usar o "id" do banco).
export function filaKey(op: OP): string {
  return `${op.op_numero}::${op.oficina ?? ""}`;
}

export function addDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

export function formataPrevisao(data: Date): string {
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
