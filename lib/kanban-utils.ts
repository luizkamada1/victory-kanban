import type { OP } from "./types";

export function diasNoSetor(dataEnvioFase: string | null): number | null {
  if (!dataEnvioFase) return null;
  const envio = new Date(dataEnvioFase);
  const hoje = new Date();
  const diffMs = hoje.setHours(0, 0, 0, 0) - envio.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
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
