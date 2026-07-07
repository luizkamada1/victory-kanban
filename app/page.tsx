"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { SETORES_ORDEM } from "@/lib/setores";
import type { OP } from "@/lib/types";
import { normaliza, abreviaOficina, filaKey } from "@/lib/kanban-utils";
import { KanbanColuna } from "@/components/KanbanColuna";

const REFRESH_MS = 5 * 60 * 1000; // 5 minutos
const STORAGE_KEY = "victory_kanban_setores_visiveis";

function formataUltimaAtualizacao(data: Date): string {
  const hoje = new Date();
  const éHoje =
    data.getFullYear() === hoje.getFullYear() &&
    data.getMonth() === hoje.getMonth() &&
    data.getDate() === hoje.getDate();
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (éHoje) return `hoje às ${hora}`;
  return `em ${data.toLocaleDateString("pt-BR")} às ${hora}`;
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
  const [oficinasVisiveis, setOficinasVisiveis] = useState(true);
  const [filaOrdem, setFilaOrdem] = useState<Record<string, string[]>>({});
  const [iniciosProducao, setIniciosProducao] = useState<
    Record<string, Record<string, { dataInicio: string; previsaoAlvo: string | null }>>
  >({});

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
      // "Atualizado às" reflete o último upload de planilha (created_at das OPs),
      // não o momento em que o navegador buscou os dados.
      const opsRecebidas: OP[] = data.ops;
      if (opsRecebidas.length > 0) {
        const maisRecente = opsRecebidas.reduce((acc, op) =>
          new Date(op.created_at) > new Date(acc.created_at) ? op : acc
        );
        setUltimaAtualizacao(new Date(maisRecente.created_at));
      } else {
        setUltimaAtualizacao(null);
      }
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

  const carregarFila = useCallback(async () => {
    try {
      const resp = await fetch("/api/fila", { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok) return;
      setFilaOrdem(data.filas || {});
    } catch {
      // ordem manual é informativa; falha aqui não deve travar o kanban
    }
  }, []);

  const carregarIniciosProducao = useCallback(async () => {
    try {
      const resp = await fetch("/api/inicio-producao", { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok) return;
      setIniciosProducao(data.inicios || {});
    } catch {
      // informativo; falha aqui não deve travar o kanban
    }
  }, []);

  const atualizarTudo = useCallback(() => {
    carregarDados();
    carregarCapacidade();
    carregarFila();
    carregarIniciosProducao();
  }, [carregarDados, carregarCapacidade, carregarFila, carregarIniciosProducao]);

  useEffect(() => {
    atualizarTudo();
    const interval = setInterval(atualizarTudo, REFRESH_MS);
    return () => clearInterval(interval);
  }, [atualizarTudo]);

  function persistirOrdem(setor: string, novaOrdem: string[]) {
    setFilaOrdem((atual) => ({ ...atual, [setor]: novaOrdem }));
    fetch("/api/fila", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setor, ordem: novaOrdem }),
    }).catch(() => {
      // se falhar, a próxima carregarFila() volta pro estado salvo no banco
    });
  }

  function iniciarProducao(setor: string, chave: string, previsaoAlvo: string | null) {
    setIniciosProducao((atual) => ({
      ...atual,
      [setor]: { ...atual[setor], [chave]: { dataInicio: new Date().toISOString(), previsaoAlvo } },
    }));
    fetch("/api/inicio-producao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setor, chave, previsaoAlvo }),
    }).catch(() => {
      // se falhar, a próxima carregarIniciosProducao() volta pro estado salvo no banco
    });
  }

  function desfazerInicioProducao(setor: string, chave: string) {
    setIniciosProducao((atual) => {
      const copiaSetor = { ...atual[setor] };
      delete copiaSetor[chave];
      return { ...atual, [setor]: copiaSetor };
    });
    fetch("/api/inicio-producao", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setor, chave }),
    }).catch(() => {
      // se falhar, a próxima carregarIniciosProducao() volta pro estado salvo no banco
    });
  }

  const buscaNormalizada = normaliza(busca.trim());

  const opsFiltradas = useMemo(() => {
    if (!buscaNormalizada) return ops;
    return ops.filter(
      (op) =>
        normaliza(op.op_numero).includes(buscaNormalizada) ||
        normaliza(op.codigo || "").includes(buscaNormalizada) ||
        normaliza(op.produto || "").includes(buscaNormalizada) ||
        normaliza(op.oficina || "").includes(buscaNormalizada) ||
        normaliza(abreviaOficina(op.oficina || "")).includes(buscaNormalizada)
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

  const totalOps = new Set(opsFiltradas.map((op) => op.op_numero)).size;
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
            <a href="/dashboard" style={estilos.botao}>
              Dashboard
            </a>
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
              placeholder="Buscar por OP, código, produto ou oficina..."
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
                · última planilha enviada {formataUltimaAtualizacao(ultimaAtualizacao)}
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
              const cardsBase = opsPorSetor.get(setor) || [];
              const ordemSalva = filaOrdem[setor];
              let cards: OP[];
              if (ordemSalva && ordemSalva.length > 0) {
                const posicao = new Map(ordemSalva.map((chave, idx) => [chave, idx]));
                cards = [...cardsBase].sort((a, b) => {
                  const pa = posicao.has(filaKey(a)) ? posicao.get(filaKey(a))! : Infinity;
                  const pb = posicao.has(filaKey(b)) ? posicao.get(filaKey(b))! : Infinity;
                  if (pa !== pb) return pa - pb;
                  return (b.quantidade || 0) - (a.quantidade || 0);
                });
              } else {
                cards = [...cardsBase].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0));
              }

              return (
                <KanbanColuna
                  key={setor}
                  setor={setor}
                  cards={cards}
                  capacidadeSetores={capacidadeSetores}
                  capacidadeOficinas={capacidadeOficinas}
                  oficinasVisiveis={oficinasVisiveis}
                  onToggleOficinasVisiveis={() => setOficinasVisiveis((v) => !v)}
                  onReordenar={persistirOrdem}
                  iniciosProducao={iniciosProducao[setor] ?? {}}
                  onIniciar={iniciarProducao}
                  onDesfazerInicio={desfazerInicioProducao}
                />
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
};
