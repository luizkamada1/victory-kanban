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
    const acao = body.acao === "desfazer" ? "desfazer" : "concluir";
    if (!id) {
      return NextResponse.json({ error: "'id' é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: linha, error: buscaError } = await supabase
      .from("producao_celulas")
      .select("op_numero, codigo, produto, celula, tipo_peca, quantidade, data_inicio, previsao_alvo, status")
      .eq("id", id)
      .maybeSingle();
    if (buscaError) throw buscaError;
    if (!linha) {
      return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
    }

    if (acao === "concluir") {
      if (linha.status !== "em_andamento") {
        return NextResponse.json({ error: "Essa produção já está concluída." }, { status: 400 });
      }
      const quantidadeConcluida = Number(body.quantidade);
      if (!Number.isFinite(quantidadeConcluida) || quantidadeConcluida <= 0) {
        return NextResponse.json({ error: "Informe uma quantidade concluída maior que zero." }, { status: 400 });
      }
      if (quantidadeConcluida > linha.quantidade) {
        return NextResponse.json(
          { error: "A quantidade concluída não pode ser maior que a quantidade em andamento." },
          { status: 400 }
        );
      }

      const agora = new Date().toISOString();

      if (quantidadeConcluida === linha.quantidade) {
        // Concluiu o lote inteiro: o próprio registro vira "concluido".
        const { error } = await supabase
          .from("producao_celulas")
          .update({ status: "concluido", quantidade_concluida: linha.quantidade, data_conclusao: agora })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // Conclusão parcial: reduz a quantidade que continua em andamento e
      // registra a parte concluída como um novo lote independente — assim o
      // lote original permanece ativo com o restante.
      const { error: reduzError } = await supabase
        .from("producao_celulas")
        .update({ quantidade: linha.quantidade - quantidadeConcluida })
        .eq("id", id);
      if (reduzError) throw reduzError;

      const { error: insertError } = await supabase.from("producao_celulas").insert({
        op_numero: linha.op_numero,
        codigo: linha.codigo,
        produto: linha.produto,
        celula: linha.celula,
        tipo_peca: linha.tipo_peca,
        quantidade: quantidadeConcluida,
        data_inicio: linha.data_inicio,
        previsao_alvo: linha.previsao_alvo,
        status: "concluido",
        quantidade_concluida: quantidadeConcluida,
        data_conclusao: agora,
      });
      if (insertError) throw insertError;

      return NextResponse.json({ ok: true });
    }

    // acao === "desfazer" — reverte uma conclusão (manual ou automática) pro
    // estado "em andamento". Só é permitido enquanto a OP ainda está mesmo na
    // Costura Interna: se a planilha já confirmou que ela seguiu pra outro
    // setor, "ressuscitar" o registro criaria uma inconsistência com o que o
    // ERP diz que aconteceu de verdade.
    if (linha.status !== "concluido") {
      return NextResponse.json({ error: "Essa produção ainda não foi concluída." }, { status: 400 });
    }
    const { data: opAtual, error: opError } = await supabase
      .from("producao_ops")
      .select("op_numero")
      .eq("op_numero", linha.op_numero)
      .eq("setor", "COSTURA INTERNA")
      .maybeSingle();
    if (opError) throw opError;
    if (!opAtual) {
      return NextResponse.json(
        {
          error:
            "Não é possível desfazer: essa OP já saiu da Costura Interna numa planilha mais recente.",
        },
        { status: 409 }
      );
    }

    const { error: desfazerError } = await supabase
      .from("producao_celulas")
      .update({ status: "em_andamento", quantidade_concluida: 0, data_conclusao: null })
      .eq("id", id);
    if (desfazerError) throw desfazerError;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: "'id' é obrigatório." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: linha, error: buscaError } = await supabase
      .from("producao_celulas")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (buscaError) throw buscaError;
    if (!linha) {
      return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
    }

    // Desfaz o "Dar andamento" — só permitido enquanto ainda está em
    // andamento (se já foi concluída, é preciso desfazer a conclusão antes).
    if (linha.status !== "em_andamento") {
      return NextResponse.json(
        { error: "Essa produção já foi concluída — desfaça a conclusão antes de desfazer o início." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("producao_celulas").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: extrairMensagem(err) }, { status: 500 });
  }
}
