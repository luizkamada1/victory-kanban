import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extrairMensagem(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Erro desconhecido";
}

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("fila_ordem")
      .select("setor, chave, posicao")
      .order("posicao", { ascending: true });
    if (error) throw error;

    const filas: Record<string, string[]> = {};
    for (const row of data ?? []) {
      if (!filas[row.setor]) filas[row.setor] = [];
      filas[row.setor].push(row.chave);
    }
    return NextResponse.json({ filas });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const setor = String(body.setor ?? "").trim();
    const ordem: string[] = Array.isArray(body.ordem) ? body.ordem : [];
    if (!setor) {
      return NextResponse.json({ error: "Setor é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { error: deleteError } = await supabase.from("fila_ordem").delete().eq("setor", setor);
    if (deleteError) throw deleteError;

    if (ordem.length > 0) {
      const linhas = ordem.map((chave, idx) => ({
        setor,
        chave,
        posicao: idx,
        updated_at: new Date().toISOString(),
      }));
      const { error: insertError } = await supabase.from("fila_ordem").insert(linhas);
      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}
