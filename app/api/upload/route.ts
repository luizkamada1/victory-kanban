import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseServer } from "@/lib/supabase";

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

    return NextResponse.json({ ok: true, total_ops: linhas.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
