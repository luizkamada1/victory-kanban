import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const inicio = searchParams.get("inicio");
    const fim = searchParams.get("fim");
    if (!inicio || !fim) {
      return NextResponse.json({ error: "Parâmetros 'inicio' e 'fim' são obrigatórios." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("historico_transicoes")
      .select("setor, quantidade, op_numero, data_saida")
      .gte("data_saida", inicio)
      .lte("data_saida", fim);
    if (error) throw error;

    const porSetor = new Map<string, { pecas: number; ops: Set<string> }>();
    for (const linha of data ?? []) {
      const atual = porSetor.get(linha.setor) ?? { pecas: 0, ops: new Set<string>() };
      atual.pecas += linha.quantidade;
      atual.ops.add(linha.op_numero);
      porSetor.set(linha.setor, atual);
    }

    const porSetorArray = Array.from(porSetor.entries())
      .map(([setor, { pecas, ops }]) => ({ setor, pecas, ops: ops.size }))
      .sort((a, b) => b.pecas - a.pecas);

    return NextResponse.json({ porSetor: porSetorArray });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
