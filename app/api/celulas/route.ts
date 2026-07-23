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
    const { data, error } = await supabase.from("capacidade_celulas").select("celula, capacidade_diaria");
    if (error) throw error;

    const celulas: Record<string, number> = {};
    for (const row of data ?? []) celulas[row.celula] = row.capacidade_diaria;

    return NextResponse.json({ celulas });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const celulas: Record<string, number> = body.celulas ?? {};
    const remover: string[] = Array.isArray(body.remover) ? body.remover : [];

    const supabase = getSupabaseServer();

    const linhas = Object.entries(celulas).map(([celula, capacidade_diaria]) => ({
      celula,
      capacidade_diaria: Number(capacidade_diaria) || 0,
      updated_at: new Date().toISOString(),
    }));

    if (linhas.length > 0) {
      const { error } = await supabase.from("capacidade_celulas").upsert(linhas, { onConflict: "celula" });
      if (error) throw error;
    }
    if (remover.length > 0) {
      const { error } = await supabase.from("capacidade_celulas").delete().in("celula", remover);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}
