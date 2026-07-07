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

// Soma dias ÚTEIS a uma data (pula sábado e domingo) — usado nas previsões de
// conclusão, pra não contar fim de semana como capacidade produtiva.
export function addDiasUteis(data: Date, diasUteis: number): Date {
  const resultado = new Date(data);
  let restante = diasUteis;
  while (restante > 0) {
    resultado.setDate(resultado.getDate() + 1);
    const diaSemana = resultado.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) restante--;
  }
  return resultado;
}

export function formataPrevisao(data: Date): string {
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formataDataHora(dataIso: string): string {
  const data = new Date(dataIso);
  const dataStr = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const horaStr = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dataStr} às ${horaStr}`;
}

// Verifica se uma previsão (baseada em dias úteis) já passou, comparando só a
// data (sem horário) — usado pra marcar uma OP como "atrasada" quando ela foi
// iniciada de verdade e a previsão ficou no passado.
export function estaAtrasada(previsao: Date): boolean {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataPrevisao = new Date(previsao);
  dataPrevisao.setHours(0, 0, 0, 0);
  return dataPrevisao < hoje;
}
