import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { calcPrevisaoAlvo } from "@/lib/kanban-utils";

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
      .from("producao_celulas")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ producoes: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const opNumero = String(body.opNumero ?? "").trim();
    const codigo = body.codigo ? String(body.codigo) : null;
    const produto = body.produto ? String(body.produto) : null;
    const celula = String(body.celula ?? "").trim();
    const tipoPeca: string[] = Array.isArray(body.tipoPeca) ? body.tipoPeca : [];
    const quantidade = Number(body.quantidade) || 0;

    if (!opNumero || !celula || quantidade <= 0) {
      return NextResponse.json(
        { error: "'opNumero', 'celula' e 'quantidade' (> 0) são obrigatórios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: capData, error: capError } = await supabase
      .from("capacidade_celulas")
      .select("capacidade_diaria")
      .eq("celula", celula)
      .maybeSingle();
    if (capError) throw capError;

    const capacidade = capData?.capacidade_diaria ?? 0;
    const alvo = calcPrevisaoAlvo(new Date(), quantidade, capacidade);

    const { error: insertError } = await supabase.from("producao_celulas").insert({
      op_numero: opNumero,
      codigo,
      produto,
      celula,
      tipo_peca: tipoPeca,
      quantidade,
      data_inicio: new Date().toISOString(),
      previsao_alvo: alvo ? alvo.toISOString() : null,
      status: "em_andamento",
    });
    if (insertError) throw insertError;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: "'id' é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: linha, error: buscaError } = await supabase
      .from("producao_celulas")
      .select("quantidade")
      .eq("id", id)
      .maybeSingle();
    if (buscaError) throw buscaError;
    if (!linha) {
      return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
    }

    const { error } = await supabase
      .from("producao_celulas")
      .update({
        status: "concluido",
        quantidade_concluida: linha.quantidade,
        data_conclusao: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}
