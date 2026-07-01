"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { SETORES_ORDEM, SETORES_COM_OFICINA } from "@/lib/setores";

type OP = {
  id: number;
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

const REFRESH_MS = 5 * 60 * 1000; // 5 minutos
const STORAGE_KEY = "victory_kanban_setores_visiveis";

function diasNoSetor(dataEnvioFase: string | null): number | null {
  if (!dataEnvioFase) return null;
  const envio = new Date(dataEnvioFase);
  const hoje = new Date();
  const diffMs = hoje.setHours(0, 0, 0, 0) - envio.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function corAlerta(dias: number | null): string {
  if (dias === null) return "#9ca3af";
  if (dias >= 7) return "#dc2626";
  if (dias >= 3) return "#d97706";
  return "#16a34a";
}

export default function KanbanPage() {
  const [ops, setOps] = useState<OP[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [setoresVisiveis, setSetoresVisiveis] = useState<Set<string>>(
    new Set(SETORES_ORDEM)
  );
  const [mostrarFiltro, setMostrarFiltro] = useState(false);

  useEffect(() => {
    const salvo = window.localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      try {
        const lista: string[] = JSON.parse(salvo);
        setSetoresVisiveis(new Set(lista));
      } catch {
        // ignora e usa padrão
      }
    }
  }, []);

  const persistirSetoresVisiveis = useCallback((novo: Set<string>) => {
    setSetoresVisiveis(novo);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(novo)));
  }, []);

  const carregarDados = useCallback(async () => {
    try {
      const resp = await fetch("/api/ops", { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro ao carregar dados");
      setOps(data.ops);
      setUltimaAtualizacao(new Date());
      setErro(null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
    const interval = setInterval(carregarDados, REFRESH_MS);
    return () => clearInterval(interval);
  }, [carregarDados]);

  const opsPorSetor = useMemo(() => {
    const mapa = new Map<string, OP[]>();
    for (const setor of SETORES_ORDEM) mapa.set(setor, []);
    for (const op of ops) {
      if (!mapa.has(op.setor)) mapa.set(op.setor, []); // setor fora da lista fixa, mostra mesmo assim
      mapa.get(op.setor)!.push(op);
    }
    return mapa;
  }, [ops]);

  const colunasParaExibir = useMemo(() => {
    const todasColunas = Array.from(opsPorSetor.keys());
    // mantém a ordem oficial primeiro, depois qualquer setor extra não previsto
    const ordenadas = [
      ...SETORES_ORDEM.filter((s) => todasColunas.includes(s)),
      ...todasColunas.filter((s) => !(SETORES_ORDEM as readonly string[]).includes(s)),
    ];
    return ordenadas.filter((s) => setoresVisiveis.has(s));
  }, [opsPorSetor, setoresVisiveis]);

  function toggleSetor(setor: string) {
    const novo = new Set(setoresVisiveis);
    if (novo.has(setor)) novo.delete(setor);
    else novo.add(setor);
    persistirSetoresVisiveis(novo);
  }

  const totalOps = ops.length;
  const totalPecas = ops.reduce((acc, op) => acc + (op.quantidade || 0), 0);

  return (
    <div style={{ padding: "20px 24px", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Victory Pijamas — Produção
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
            {totalOps} OPs em andamento · {totalPecas.toLocaleString("pt-BR")} peças
            {ultimaAtualizacao && (
              <> · atualizado às {ultimaAtualizacao.toLocaleTimeString("pt-BR")}</>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setMostrarFiltro((v) => !v)}
            style={botaoSecundario}
          >
            Setores visíveis
          </button>
          <button onClick={carregarDados} style={botaoSecundario}>
            Atualizar agora
          </button>
          <a href="/upload" style={{ ...botaoSecundario, textDecoration: "none" }}>
            Enviar planilha
          </a>
        </div>
      </header>

      {mostrarFiltro && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          {SETORES_ORDEM.map((setor) => (
            <label
              key={setor}
              style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={setoresVisiveis.has(setor)}
                onChange={() => toggleSetor(setor)}
              />
              {setor}
            </label>
          ))}
        </div>
      )}

      {erro && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 8, marginBottom: 16 }}>
          Erro: {erro}
        </div>
      )}

      {loading ? (
        <p>Carregando...</p>
      ) : totalOps === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
          Nenhuma OP encontrada. <a href="/upload">Envie a primeira planilha</a>.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12 }}>
          {colunasParaExibir.map((setor) => {
            const cards = (opsPorSetor.get(setor) || []).sort(
              (a, b) => (b.quantidade || 0) - (a.quantidade || 0)
            );
            return (
              <div
                key={setor}
                style={{
                  minWidth: 260,
                  maxWidth: 260,
                  background: "#eef0f3",
                  borderRadius: 10,
                  padding: 10,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{setor}</span>
                  <span style={{ color: "#666", fontWeight: 400 }}>{cards.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cards.map((op) => {
                    const dias = diasNoSetor(op.data_envio_fase);
                    const mostrarOficina = SETORES_COM_OFICINA.includes(op.setor);
                    return (
                      <div
                        key={op.id}
                        style={{
                          background: "#fff",
                          borderRadius: 8,
                          padding: "8px 10px",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                          fontSize: 12.5,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                          <span>OP {op.op_numero}</span>
                          <span>{op.quantidade.toLocaleString("pt-BR")} pç</span>
                        </div>
                        <div style={{ color: "#333", marginTop: 2 }}>{op.codigo}</div>
                        <div style={{ color: "#555", marginTop: 2, lineHeight: 1.3 }}>
                          {op.produto}
                        </div>
                        {mostrarOficina && op.oficina && (
                          <div style={{ color: "#555", marginTop: 4 }}>
                            Oficina: <strong>{op.oficina}</strong>
                          </div>
                        )}
                        {dias !== null && (
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              color: corAlerta(dias),
                            }}
                          >
                            {dias === 0 ? "Entrou hoje" : `${dias} dia${dias > 1 ? "s" : ""} no setor`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const botaoSecundario: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 13,
  cursor: "pointer",
  color: "#1a1a2e",
};
