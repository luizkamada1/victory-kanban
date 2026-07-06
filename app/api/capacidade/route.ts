import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { SETORES_COM_CAPACIDADE } from "@/lib/setores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseServer();

    const [{ data: setoresData, error: setoresError }, { data: oficinasData, error: oficinasError }, { data: opsData, error: opsError }] =
      await Promise.all([
        supabase.from("capacidade_setores").select("setor, capacidade_diaria"),
        supabase.from("capacidade_oficinas").select("oficina, capacidade_diaria"),
        supabase.from("producao_ops").select("oficina").eq("setor", "COSTURA EXTERNA"),
      ]);

    if (setoresError) throw setoresError;
    if (oficinasError) throw oficinasError;
    if (opsError) throw opsError;

    const setores: Record<string, number> = {};
    for (const setor of SETORES_COM_CAPACIDADE) setores[setor] = 0;
    for (const row of setoresData ?? []) {
      setores[row.setor] = row.capacidade_diaria;
    }

    const oficinas: Record<string, number> = {};
    for (const row of oficinasData ?? []) {
      oficinas[row.oficina] = row.capacidade_diaria;
    }
    // inclui oficinas que já apareceram em planilhas mas ainda não têm capacidade configurada
    for (const row of opsData ?? []) {
      const nome = row.oficina?.trim();
      if (nome && !(nome in oficinas)) oficinas[nome] = 0;
    }

    return NextResponse.json({ setores, oficinas });
  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const setores: Record<string, number> = body.setores ?? {};
    const oficinas: Record<string, number> = body.oficinas ?? {};
    const remover: string[] = Array.isArray(body.remover) ? body.remover : [];

    const supabase = getSupabaseServer();

    const linhasSetores = Object.entries(setores).map(([setor, capacidade_diaria]) => ({
      setor,
      capacidade_diaria: Number(capacidade_diaria) || 0,
      updated_at: new Date().toISOString(),
    }));
    const linhasOficinas = Object.entries(oficinas).map(([oficina, capacidade_diaria]) => ({
      oficina,
      capacidade_diaria: Number(capacidade_diaria) || 0,
      updated_at: new Date().toISOString(),
    }));

    if (linhasSetores.length > 0) {
      const { error } = await supabase.from("capacidade_setores").upsert(linhasSetores, { onConflict: "setor" });
      if (error) throw error;
    }
    if (linhasOficinas.length > 0) {
      const { error } = await supabase.from("capacidade_oficinas").upsert(linhasOficinas, { onConflict: "oficina" });
      if (error) throw error;
    }
    if (remover.length > 0) {
      const { error } = await supabase.from("capacidade_oficinas").delete().in("oficina", remover);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
