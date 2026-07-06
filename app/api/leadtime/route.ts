import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { diasUteisEntre } from "@/lib/kanban-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Transicao = {
  op_numero: string;
  setor: string;
  quantidade: number;
  data_entrada: string | null;
  data_saida: string;
  dias_uteis: number;
  tipo: string;
};

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("historico_transicoes")
      .select("op_numero, setor, quantidade, data_entrada, data_saida, dias_uteis, tipo");
    if (error) throw error;

    const transicoes = (data ?? []) as Transicao[];

    // Lead time médio por setor: média de dias úteis de todas as transições
    // registradas naquele setor (independente de ter avançado ou concluído).
    const porSetor = new Map<string, { soma: number; amostras: number }>();
    for (const t of transicoes) {
      const atual = porSetor.get(t.setor) ?? { soma: 0, amostras: 0 };
      atual.soma += t.dias_uteis;
      atual.amostras += 1;
      porSetor.set(t.setor, atual);
    }
    const leadTimePorSetor = Array.from(porSetor.entries())
      .map(([setor, { soma, amostras }]) => ({
        setor,
        mediaDias: soma / amostras,
        amostras,
      }))
      .sort((a, b) => b.mediaDias - a.mediaDias);

    // Lead time geral (fim a fim): pra cada OP que já concluiu (saiu do processo
    // de vez em alguma transição), calcula o intervalo de tempo entre a entrada
    // mais antiga registrada e a saída da conclusão — não é soma dos tempos por
    // setor, porque a mesma OP pode ter lotes rodando em paralelo em setores
    // diferentes (ex: parte em CORTE e parte já em COSTURA ao mesmo tempo).
    const porOp = new Map<string, Transicao[]>();
    for (const t of transicoes) {
      const lista = porOp.get(t.op_numero) ?? [];
      lista.push(t);
      porOp.set(t.op_numero, lista);
    }

    const leadTimesGerais: number[] = [];
    for (const [, lista] of porOp) {
      const concluiu = lista.filter((t) => t.tipo === "concluiu");
      if (concluiu.length === 0) continue;
      const entradas = lista.map((t) => t.data_entrada).filter(Boolean) as string[];
      if (entradas.length === 0) continue;
      const entradaMaisAntiga = entradas.reduce((a, b) => (a < b ? a : b));
      const saidaMaisRecente = concluiu
        .map((t) => t.data_saida)
        .reduce((a, b) => (a > b ? a : b));
      leadTimesGerais.push(diasUteisEntre(entradaMaisAntiga, saidaMaisRecente));
    }

    const leadTimeGeral =
      leadTimesGerais.length > 0
        ? leadTimesGerais.reduce((a, b) => a + b, 0) / leadTimesGerais.length
        : null;

    return NextResponse.json({
      leadTimePorSetor,
      leadTimeGeral,
      amostrasGeral: leadTimesGerais.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
