import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseServer } from "@/lib/supabase";
import { diasUteisEntre, diasUteisComSinal } from "@/lib/kanban-utils";

export const runtime = "nodejs";

type LinhaAgregada = {
  op_numero: string;
  setor: string;
  codigo: string;
  produto: string;
  quantidade: number;
  data_envio_fase: string | null;
  data_op: string | null;
  data_entrega: string | null;
  oficina: string | null;
};

function excelDateToISO(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  // já veio como string de data
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // número serial do Excel
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return d.toISOString();
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Proteção simples opcional por senha de upload (defina UPLOAD_PASSCODE no ambiente para ativar)
    const passcodeEsperado = process.env.UPLOAD_PASSCODE;
    const form = await req.formData();
    const passcodeRecebido = form.get("passcode")?.toString() ?? "";
    if (passcodeEsperado && passcodeRecebido !== passcodeEsperado) {
      return NextResponse.json({ error: "Senha de upload inválida." }, { status: 401 });
    }

    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    // Agrupa por (Producao, Fase.1) somando a quantidade e mantendo a data de envio à fase mais antiga
    const grupos = new Map<string, LinhaAgregada>();

    for (const row of rows) {
      const opNumero = String(row["Producao"] ?? "").trim();
      let setor = String(row["Fase_1"] ?? "").trim();
      if (!opNumero || !setor) continue;

      const qtde = Number(row["Qtde andamento"] ?? 0) || 0;
      const dataEnvio = excelDateToISO(row["Data envio fase"]);
      const dataOp = excelDateToISO(row["Data OP"]);
      const dataEntrega = excelDateToISO(row["Data de entrega"]);
      const oficina = row["Oficina"] ? String(row["Oficina"]).trim() : null;

      // Divide o setor COSTURA em COSTURA INTERNA / COSTURA EXTERNA conforme a oficina
      if (setor === "COSTURA") {
        setor = oficina && oficina.toUpperCase() === "COSTURA INTERNA" ? "COSTURA INTERNA" : "COSTURA EXTERNA";
      }

      const chave = `${opNumero}__${setor}__${oficina ?? ""}`;

      const existente = grupos.get(chave);
      if (existente) {
        existente.quantidade += qtde;
        // mantém a data de envio à fase mais antiga (quando o lote mais antigo entrou no setor)
        if (dataEnvio && (!existente.data_envio_fase || dataEnvio < existente.data_envio_fase)) {
          existente.data_envio_fase = dataEnvio;
        }
        if (!existente.oficina && oficina) existente.oficina = oficina;
      } else {
        grupos.set(chave, {
          op_numero: opNumero,
          setor,
          codigo: String(row["Código"] ?? "").trim(),
          produto: String(row["Produto"] ?? "").trim(),
          quantidade: qtde,
          data_envio_fase: dataEnvio,
          data_op: dataOp,
          data_entrega: dataEntrega,
          oficina,
        });
      }
    }

    const linhas = Array.from(grupos.values());
    if (linhas.length === 0) {
      return NextResponse.json(
        { error: "Não encontrei linhas válidas (verifique as colunas 'Producao' e 'Fase.1')." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Lê o snapshot anterior ANTES de sobrescrever, pra detectar o que mudou de
    // setor (ou saiu do processo de vez) e alimentar o histórico de lead time.
    const { data: linhasAntigas, error: antigasError } = await supabase
      .from("producao_ops")
      .select("op_numero, setor, oficina, quantidade, data_envio_fase");
    if (antigasError) throw antigasError;

    // Previsões-alvo congeladas (ver op_inicio_producao) — usadas pra saber se
    // uma OP que está saindo do setor entregou antes ou depois do previsto.
    const { data: iniciosData, error: iniciosError } = await supabase
      .from("op_inicio_producao")
      .select("setor, chave, previsao_alvo");
    if (iniciosError) throw iniciosError;
    const previsoesAlvoPorChave = new Map(
      (iniciosData ?? [])
        .filter((i) => i.previsao_alvo)
        .map((i) => [`${i.setor}::${i.chave}`, i.previsao_alvo as string])
    );

    // Substitui todo o snapshot anterior pelo novo
    const { error: deleteError } = await supabase.from("producao_ops").delete().neq("op_numero", "");
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("producao_ops").insert(linhas);
    if (insertError) throw insertError;

    // Guarda um snapshot agregado do dia (por setor) pros gráficos de evolução do dashboard
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const porSetor = new Map<string, { ops: Set<string>; pecas: number }>();
    for (const linha of linhas) {
      const atual = porSetor.get(linha.setor) ?? { ops: new Set<string>(), pecas: 0 };
      atual.ops.add(linha.op_numero);
      atual.pecas += linha.quantidade;
      porSetor.set(linha.setor, atual);
    }
    const linhasHistorico = Array.from(porSetor.entries()).map(([setor, { ops, pecas }]) => ({
      data: hoje,
      setor,
      total_ops: ops.size,
      total_pecas: pecas,
    }));
    const { error: historicoError } = await supabase
      .from("historico_diario")
      .upsert(linhasHistorico, { onConflict: "data,setor" });
    if (historicoError) throw historicoError;

    // Detecta transições: uma linha antiga (op+setor+oficina) que não existe mais
    // no snapshot novo significa que aquele lote saiu daquele setor — ou porque
    // avançou pra outro setor (a OP ainda aparece em algum lugar), ou porque
    // concluiu e saiu do processo de vez (a OP não aparece em nenhum setor mais).
    const chaveTransicao = (op: string, setor: string, oficina: string | null) =>
      `${op}::${setor}::${oficina ?? ""}`;
    const chavesNovas = new Set(linhas.map((l) => chaveTransicao(l.op_numero, l.setor, l.oficina)));
    const opNumerosNovos = new Set(linhas.map((l) => l.op_numero));
    const novaPorChave = new Map(
      linhas.map((l) => [chaveTransicao(l.op_numero, l.setor, l.oficina), l])
    );

    const transicoesCompletas = (linhasAntigas ?? [])
      .filter((antiga) => !chavesNovas.has(chaveTransicao(antiga.op_numero, antiga.setor, antiga.oficina)))
      .map((antiga) => {
        const chaveInicio = `${antiga.setor}::${antiga.op_numero}::${antiga.oficina ?? ""}`;
        const previsaoAlvo = previsoesAlvoPorChave.get(chaveInicio) ?? null;
        return {
          op_numero: antiga.op_numero,
          setor: antiga.setor,
          oficina: antiga.oficina,
          quantidade: antiga.quantidade,
          data_entrada: antiga.data_envio_fase,
          data_saida: hoje,
          dias_uteis: diasUteisEntre(antiga.data_envio_fase, hoje),
          tipo: opNumerosNovos.has(antiga.op_numero) ? "avancou" : "concluiu",
          dias_desempenho: previsaoAlvo ? diasUteisComSinal(previsaoAlvo, hoje) : null,
        };
      });

    // A OP saiu do setor de vez — o registro de "iniciada" não serve mais.
    const chavesParaLimpar = (linhasAntigas ?? [])
      .filter((antiga) => !chavesNovas.has(chaveTransicao(antiga.op_numero, antiga.setor, antiga.oficina)))
      .map((antiga) => ({ setor: antiga.setor, chave: `${antiga.op_numero}::${antiga.oficina ?? ""}` }));

    // Transições parciais: a linha (op+setor+oficina) continua existindo, só que
    // com menos peças do que antes — a diferença já saiu desse setor (avançou
    // pra outro), mesmo sem a OP desaparecer inteira dali. Sem isso, mover só
    // parte da quantidade de uma OP ficava invisível pro cálculo de produção.
    const transicoesParciais = (linhasAntigas ?? [])
      .map((antiga) => {
        const chave = chaveTransicao(antiga.op_numero, antiga.setor, antiga.oficina);
        const nova = novaPorChave.get(chave);
        if (!nova || nova.quantidade >= antiga.quantidade) return null;
        return {
          op_numero: antiga.op_numero,
          setor: antiga.setor,
          oficina: antiga.oficina,
          quantidade: antiga.quantidade - nova.quantidade,
          data_entrada: antiga.data_envio_fase,
          data_saida: hoje,
          dias_uteis: diasUteisEntre(antiga.data_envio_fase, hoje),
          tipo: "avancou",
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    const transicoes = [...transicoesCompletas, ...transicoesParciais];

    if (transicoes.length > 0) {
      const { error: transicoesError } = await supabase.from("historico_transicoes").insert(transicoes);
      if (transicoesError) throw transicoesError;
    }

    if (chavesParaLimpar.length > 0) {
      await Promise.all(
        chavesParaLimpar.map(({ setor, chave }) =>
          supabase.from("op_inicio_producao").delete().eq("setor", setor).eq("chave", chave)
        )
      );
    }

    return NextResponse.json({ ok: true, total_ops: linhas.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
