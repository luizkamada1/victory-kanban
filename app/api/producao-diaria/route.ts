import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const setor = searchParams.get("setor");
    const inicio = searchParams.get("inicio");
    const fim = searchParams.get("fim");
    if (!setor || !inicio || !fim) {
      return NextResponse.json(
        { error: "Parâmetros 'setor', 'inicio' e 'fim' são obrigatórios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("historico_transicoes")
      .select("data_saida, quantidade")
      .eq("setor", setor)
      .gte("data_saida", inicio)
      .lte("data_saida", fim);
    if (error) throw error;

    const porDia = new Map<string, number>();
    for (const linha of data ?? []) {
      porDia.set(linha.data_saida, (porDia.get(linha.data_saida) ?? 0) + linha.quantidade);
    }

    const pontos = Array.from(porDia.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, pecas]) => ({ data, pecas }));

    return NextResponse.json({ pontos });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
