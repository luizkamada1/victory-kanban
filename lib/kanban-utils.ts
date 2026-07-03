import type { OP } from "./types";

// Conta só dias úteis (segunda a sexta) entre a data de envio à fase e hoje —
// sábado e domingo não contam como "parado" no setor. Não considera feriados.
export function diasNoSetor(dataEnvioFase: string | null): number | null {
  if (!dataEnvioFase) return null;
  const envio = new Date(dataEnvioFase);
  envio.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (hoje <= envio) return 0;

  let dias = 0;
  const cursor = new Date(envio);
  while (cursor < hoje) {
    cursor.setDate(cursor.getDate() + 1);
    const diaSemana = cursor.getDay(); // 0 = domingo, 6 = sábado
    if (diaSemana !== 0 && diaSemana !== 6) dias++;
  }
  return dias;
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
