import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Soma, por OP, quanto já foi confirmado como tendo saído de um setor
// segundo a planilha (historico_transicoes) — usado pra saber se uma
// conclusão marcada na tela da Costura Interna já foi de fato refletida no
// ERP, mesmo quando a OP teve conclusão parcial (parte ainda no setor).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const setor = searchParams.get("setor");
    if (!setor) {
      return NextResponse.json({ error: "'setor' é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("historico_transicoes")
      .select("op_numero, quantidade")
      .eq("setor", setor);
    if (error) throw error;

    const porOp: Record<string, number> = {};
    for (const linha of data ?? []) {
      porOp[linha.op_numero] = (porOp[linha.op_numero] ?? 0) + linha.quantidade;
    }

    return NextResponse.json({ porOp });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
