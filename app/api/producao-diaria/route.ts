import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const setoresParam = searchParams.get("setores");
    const inicio = searchParams.get("inicio");
    const fim = searchParams.get("fim");
    if (!setoresParam || !inicio || !fim) {
      return NextResponse.json(
        { error: "Parâmetros 'setores', 'inicio' e 'fim' são obrigatórios." },
        { status: 400 }
      );
    }
    const setores = setoresParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (setores.length === 0) {
      return NextResponse.json({ pontos: [] });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("historico_transicoes")
      .select("data_saida, setor, quantidade")
      .in("setor", setores)
      .gte("data_saida", inicio)
      .lte("data_saida", fim);
    if (error) throw error;

    const porDiaSetor = new Map<string, number>();
    for (const linha of data ?? []) {
      const chave = `${linha.data_saida}::${linha.setor}`;
      porDiaSetor.set(chave, (porDiaSetor.get(chave) ?? 0) + linha.quantidade);
    }

    const pontos = Array.from(porDiaSetor.entries()).map(([chave, pecas]) => {
      const [data, setor] = chave.split("::");
      return { data, setor, pecas };
    });

    return NextResponse.json({ pontos });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
