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
      .from("op_inicio_producao")
      .select("setor, chave, data_inicio, previsao_alvo");
    if (error) throw error;

    const inicios: Record<string, Record<string, { dataInicio: string; previsaoAlvo: string | null }>> = {};
    for (const row of data ?? []) {
      if (!inicios[row.setor]) inicios[row.setor] = {};
      inicios[row.setor][row.chave] = { dataInicio: row.data_inicio, previsaoAlvo: row.previsao_alvo };
    }
    return NextResponse.json({ inicios });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const setor = String(body.setor ?? "").trim();
    const chave = String(body.chave ?? "").trim();
    const previsaoAlvo = body.previsaoAlvo ? String(body.previsaoAlvo) : null;
    if (!setor || !chave) {
      return NextResponse.json({ error: "'setor' e 'chave' são obrigatórios." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("op_inicio_producao")
      .upsert(
        { setor, chave, data_inicio: new Date().toISOString(), previsao_alvo: previsaoAlvo },
        { onConflict: "setor,chave" }
      );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const setor = String(body.setor ?? "").trim();
    const chave = String(body.chave ?? "").trim();
    if (!setor || !chave) {
      return NextResponse.json({ error: "'setor' e 'chave' são obrigatórios." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("op_inicio_producao")
      .delete()
      .eq("setor", setor)
      .eq("chave", chave);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}
