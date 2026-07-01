"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { SETORES_ORDEM, SETORES_COM_OFICINA, SETORES_COM_CAPACIDADE } from "@/lib/setores";

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

function corOcupacao(percentual: number | null): string {
  if (percentual === null) return "#9ca3af";
  if (percentual >= 100) return "#dc2626";
  if (percentual >= 80) return "#d97706";
  return "#16a34a";
}

function normaliza(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
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
  const [busca, setBusca] = useState("");
  const [capacidadeSetores, setCapacidadeSetores] = useState<Record<string, number>>({});
  const [capacidadeOficinas, setCapacidadeOficinas] = useState<Record<string, number>>({});

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

  const carregarCapacidade = useCallback(async () => {
    try {
      const resp = await fetch("/api/capacidade", { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok) return;
      setCapacidadeSetores(data.setores || {});
      setCapacidadeOficinas(data.oficinas || {});
    } catch {
      // capacidade é informativa; falha aqui não deve travar o kanban
    }
  }, []);

  useEffect(() => {
    carregarDados();
    carregarCapacidade();
    const interval = setInterval(() => {
      carregarDados();
      carregarCapacidade();
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [carregarDados, carregarCapacidade]);

  const buscaNormalizada = normaliza(busca.trim());

  const opsFiltradas = useMemo(() => {
    if (!buscaNormalizada) return ops;
    return ops.filter(
      (op) =>
        normaliza(op.op_numero).includes(buscaNormalizada) ||
        normaliza(op.codigo || "").includes(buscaNormalizada) ||
        normaliza(op.produto || "").includes(buscaNormalizada)
    );
  }, [ops, buscaNormalizada]);

  const opsPorSetor = useMemo(() => {
    const mapa = new Map<string, OP[]>();
    for (const setor of SETORES_ORDEM) mapa.set(setor, []);
    for (const op of opsFiltradas) {
      if (!mapa.has(op.setor)) mapa.set(op.setor, []); // setor fora da lista fixa, mostra mesmo assim
      mapa.get(op.setor)!.push(op);
    }
    return mapa;
  }, [opsFiltradas]);

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

  const totalOps = opsFiltradas.length;
  const totalPecas = opsFiltradas.reduce((acc, op) => acc + (op.quantidade || 0), 0);

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={estilos.header}>
        <div style={estilos.headerTopo}>
          <div>
            <h1 style={estilos.titulo}>Victory Pijamas</h1>
            <p style={estilos.subtitulo}>Kanban de Produção</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setMostrarFiltro((v) => !v)}
              style={{ ...estilos.botao, ...(mostrarFiltro ? estilos.botaoAtivo : {}) }}
            >
              Setores visíveis
            </button>
            <button onClick={carregarDados} style={estilos.botao}>
              ↻ Atualizar
            </button>
            <a href="/capacidade" style={estilos.botao}>
              Capacidade
            </a>
            <a href="/upload" style={{ ...estilos.botao, ...estilos.botaoPrimario }}>
              Enviar planilha
            </a>
          </div>
        </div>

        <div style={estilos.headerBaixo}>
          <div style={estilos.buscaWrapper}>
            <span style={estilos.buscaIcone}>⌕</span>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por OP, código ou produto..."
              style={estilos.buscaInput}
            />
            {busca && (
              <button onClick={() => setBusca("")} style={estilos.buscaLimpar} aria-label="Limpar busca">
                ×
              </button>
            )}
          </div>

          <p style={estilos.stats}>
            <strong>{totalOps}</strong> OP{totalOps === 1 ? "" : "s"} em andamento ·{" "}
            <strong>{totalPecas.toLocaleString("pt-BR")}</strong> peças
            {ultimaAtualizacao && (
              <span style={{ color: "#9ca3af" }}>
                {" "}
                · atualizado às {ultimaAtualizacao.toLocaleTimeString("pt-BR")}
              </span>
            )}
          </p>
        </div>

        {mostrarFiltro && (
          <div style={estilos.filtroPainel}>
            {SETORES_ORDEM.map((setor) => (
              <label key={setor} style={estilos.filtroItem}>
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
      </header>

      <main style={{ padding: "0 24px 24px" }}>
        {erro && (
          <div style={estilos.erroBox}>
            <strong>Erro:</strong> {erro}
          </div>
        )}

        {loading ? (
          <div style={estilos.estadoVazio}>Carregando...</div>
        ) : ops.length === 0 ? (
          <div style={estilos.estadoVazio}>
            Nenhuma OP encontrada.{" "}
            <a href="/upload" style={estilos.link}>
              Envie a primeira planilha
            </a>
            .
          </div>
        ) : totalOps === 0 ? (
          <div style={estilos.estadoVazio}>
            Nenhuma OP encontrada para <strong>&quot;{busca}&quot;</strong>.
          </div>
        ) : (
          <div style={estilos.quadro}>
            {colunasParaExibir.map((setor) => {
              const cards = (opsPorSetor.get(setor) || []).sort(
                (a, b) => (b.quantidade || 0) - (a.quantidade || 0)
              );
              const totalPecasSetor = cards.reduce((acc, op) => acc + (op.quantidade || 0), 0);

              let capacidadeSetor: number | null = null;
              if ((SETORES_COM_CAPACIDADE as readonly string[]).includes(setor)) {
                capacidadeSetor = capacidadeSetores[setor] ?? 0;
              } else if (setor === "COSTURA EXTERNA") {
                const oficinasDoSetor = new Set(cards.map((op) => op.oficina).filter(Boolean) as string[]);
                capacidadeSetor = Array.from(oficinasDoSetor).reduce(
                  (acc, oficina) => acc + (capacidadeOficinas[oficina] ?? 0),
                  0
                );
              }
              const ocupacao =
                capacidadeSetor !== null && capacidadeSetor > 0
                  ? (totalPecasSetor / capacidadeSetor) * 100
                  : null;
              const diasServico =
                capacidadeSetor !== null && capacidadeSetor > 0
                  ? totalPecasSetor / capacidadeSetor
                  : null;
              const corOcup = corOcupacao(ocupacao);

              return (
                <div key={setor} style={estilos.coluna}>
                  <div style={estilos.colunaHeader}>
                    <div style={estilos.colunaTitulo}>{setor}</div>
                    <div style={estilos.colunaStats}>
                      <span style={estilos.colunaBadge}>{cards.length} OP{cards.length === 1 ? "" : "s"}</span>
                      <span style={estilos.colunaBadge}>
                        {totalPecasSetor.toLocaleString("pt-BR")} pç
                      </span>
                    </div>
                    {ocupacao !== null && (
                      <div style={{ ...estilos.capacidadeBox, borderColor: corOcup }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ ...estilos.capacidadePercent, color: corOcup }}>
                            {ocupacao.toFixed(0)}% da capacidade
                          </span>
                          {ocupacao >= 100 && <span style={{ fontSize: 12 }}>⚠️</span>}
                        </div>
                        <div style={estilos.capacidadeBarraFundo}>
                          <div
                            style={{
                              ...estilos.capacidadeBarraPreenchida,
                              width: `${Math.min(100, ocupacao)}%`,
                              background: corOcup,
                            }}
                          />
                        </div>
                        <span style={estilos.capacidadeDias}>
                          ≈ {diasServico!.toFixed(1)} dia{diasServico! >= 2 ? "s" : ""} de serviço
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={estilos.colunaCorpo}>
                    {cards.length === 0 ? (
                      <div style={estilos.colunaVazia}>Sem OPs</div>
                    ) : (
                      cards.map((op) => {
                        const dias = diasNoSetor(op.data_envio_fase);
                        const mostrarOficina = SETORES_COM_OFICINA.includes(op.setor);
                        const cor = corAlerta(dias);
                        return (
                          <div key={op.id} style={{ ...estilos.card, borderLeftColor: cor }}>
                            <div style={estilos.cardTopo}>
                              <span style={estilos.cardOp}>OP {op.op_numero}</span>
                              <span style={estilos.cardQtde}>
                                {op.quantidade.toLocaleString("pt-BR")} pç
                              </span>
                            </div>
                            <div style={estilos.cardCodigo}>{op.codigo}</div>
                            <div style={estilos.cardProduto}>{op.produto}</div>
                            {mostrarOficina && op.oficina && (
                              <div style={estilos.cardOficina}>
                                Oficina: <strong>{op.oficina}</strong>
                              </div>
                            )}
                            {dias !== null && (
                              <div style={{ ...estilos.cardDias, color: cor, background: cor + "1a" }}>
                                {dias === 0 ? "Entrou hoje" : `${dias} dia${dias > 1 ? "s" : ""} no setor`}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "#14142b",
    color: "#fff",
    padding: "20px 24px 16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  headerTopo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  titulo: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: -0.3,
  },
  subtitulo: {
    margin: "2px 0 0",
    fontSize: 13,
    color: "#a5a6c9",
    fontWeight: 500,
  },
  botao: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    color: "#fff",
    textDecoration: "none",
    transition: "background 0.15s",
  },
  botaoAtivo: {
    background: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.3)",
  },
  botaoPrimario: {
    background: "#6366f1",
    borderColor: "#6366f1",
  },
  headerBaixo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  buscaWrapper: {
    position: "relative",
    flex: "1 1 320px",
    maxWidth: 420,
  },
  buscaIcone: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#8b8caf",
    fontSize: 15,
    pointerEvents: "none",
  },
  buscaInput: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 8,
    padding: "9px 32px 9px 34px",
    fontSize: 13.5,
    color: "#fff",
    outline: "none",
  },
  buscaLimpar: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    color: "#a5a6c9",
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
    padding: 4,
  },
  stats: {
    margin: 0,
    fontSize: 13,
    color: "#c7c8e6",
    whiteSpace: "nowrap",
  },
  filtroPainel: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  filtroItem: {
    fontSize: 12.5,
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#e5e6f7",
  },
  erroBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "10px 14px",
    borderRadius: 8,
    marginTop: 16,
    fontSize: 13.5,
  },
  estadoVazio: {
    textAlign: "center",
    padding: 60,
    color: "#6b7280",
    fontSize: 14,
  },
  link: {
    color: "#4f46e5",
    fontWeight: 600,
  },
  quadro: {
    display: "flex",
    gap: 14,
    overflowX: "auto",
    paddingTop: 20,
    paddingBottom: 12,
    alignItems: "flex-start",
  },
  coluna: {
    minWidth: 270,
    maxWidth: 270,
    background: "#eceef2",
    borderRadius: 12,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100vh - 170px)",
  },
  colunaHeader: {
    padding: "12px 12px 10px",
    borderBottom: "1px solid #dde0e6",
  },
  colunaTitulo: {
    fontWeight: 700,
    fontSize: 13,
    color: "#1f2937",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  colunaStats: {
    display: "flex",
    gap: 6,
    marginTop: 6,
  },
  colunaBadge: {
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 999,
    padding: "2px 9px",
    fontSize: 11,
    fontWeight: 600,
    color: "#4b5563",
  },
  capacidadeBox: {
    marginTop: 10,
    background: "#fff",
    border: "1px solid",
    borderRadius: 8,
    padding: "8px 10px",
  },
  capacidadePercent: {
    fontSize: 11.5,
    fontWeight: 700,
  },
  capacidadeBarraFundo: {
    marginTop: 5,
    height: 5,
    borderRadius: 999,
    background: "#e5e7eb",
    overflow: "hidden",
  },
  capacidadeBarraPreenchida: {
    height: "100%",
    borderRadius: 999,
    transition: "width 0.2s",
  },
  capacidadeDias: {
    display: "block",
    marginTop: 5,
    fontSize: 11,
    color: "#6b7280",
    fontWeight: 500,
  },
  colunaCorpo: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 10,
    overflowY: "auto",
  },
  colunaVazia: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
    padding: "16px 0",
  },
  card: {
    background: "#fff",
    borderRadius: 8,
    borderLeft: "4px solid #9ca3af",
    padding: "10px 12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    fontSize: 12.5,
  },
  cardTopo: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 700,
    color: "#111827",
  },
  cardQtde: {
    color: "#4b5563",
    fontWeight: 600,
  },
  cardCodigo: {
    color: "#374151",
    marginTop: 3,
    fontWeight: 500,
  },
  cardProduto: {
    color: "#6b7280",
    marginTop: 2,
    lineHeight: 1.35,
  },
  cardOficina: {
    color: "#4b5563",
    marginTop: 6,
    fontSize: 12,
  },
  cardDias: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    display: "inline-block",
  },
};
