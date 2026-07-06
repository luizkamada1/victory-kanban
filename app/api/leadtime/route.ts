import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const inicio = searchParams.get("inicio");
    const fim = searchParams.get("fim");

    const supabase = getSupabaseServer();
    // Busca tudo (sem filtrar por período aqui): pro lead time geral precisamos
    // da entrada mais antiga de cada OP, que pode ser bem anterior ao período
    // selecionado — o filtro de período se aplica é a quando a transição SAIU.
    const { data, error } = await supabase
      .from("historico_transicoes")
      .select("op_numero, setor, quantidade, data_entrada, data_saida, dias_uteis, tipo");
    if (error) throw error;

    const todas = (data ?? []) as Transicao[];
    const noPeriodo = (t: Transicao) =>
      (!inicio || t.data_saida >= inicio) && (!fim || t.data_saida <= fim);

    // Lead time médio por setor: média de dias úteis das transições cuja SAÍDA
    // caiu dentro do período selecionado (independente de ter avançado ou concluído).
    const porSetor = new Map<string, { soma: number; amostras: number }>();
    for (const t of todas) {
      if (!noPeriodo(t)) continue;
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

    // Lead time geral (fim a fim): considera as OPs cuja CONCLUSÃO caiu dentro
    // do período selecionado, mas usa a entrada mais antiga registrada pra
    // aquela OP (mesmo que seja de antes do período) — não é soma dos tempos
    // por setor, porque a mesma OP pode ter lotes rodando em paralelo em
    // setores diferentes (ex: parte em CORTE e parte já em COSTURA ao mesmo
    // tempo).
    const porOp = new Map<string, Transicao[]>();
    for (const t of todas) {
      const lista = porOp.get(t.op_numero) ?? [];
      lista.push(t);
      porOp.set(t.op_numero, lista);
    }

    const leadTimesGerais: number[] = [];
    for (const [, lista] of porOp) {
      const concluiu = lista.filter((t) => t.tipo === "concluiu" && noPeriodo(t));
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
