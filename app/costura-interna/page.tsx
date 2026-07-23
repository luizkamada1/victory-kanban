"use client";

import { useEffect, useMemo, useState, useCallback, forwardRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { OP } from "@/lib/types";
import { filaKey, formataPrevisao, formataDataHora } from "@/lib/kanban-utils";
import { useHeaderRecolhido } from "@/lib/useHeaderRecolhido";

const SETOR = "COSTURA INTERNA";
const REFRESH_MS = 5 * 60 * 1000;
const TIPOS_PECA = [
  { valor: "blusa", label: "Blusa" },
  { valor: "shorts_calca", label: "Shorts/Calça" },
];

type ProducaoCelula = {
  id: number;
  op_numero: string;
  codigo: string | null;
  produto: string | null;
  celula: string;
  tipo_peca: string[];
  quantidade: number;
  data_inicio: string;
  previsao_alvo: string | null;
  status: "em_andamento" | "concluido";
  quantidade_concluida: number;
  data_conclusao: string | null;
};

function ehHoje(dataIso: string): boolean {
  const d = new Date(dataIso);
  const hoje = new Date();
  return (
    d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate()
  );
}

function ehMesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Converte hora fracionada (ex: 10.75) em "10:45", pro eixo/tooltip do
// gráfico de produção acumulada do dia.
function formataHoraFracionada(hora: number): string {
  const h = Math.floor(hora);
  const m = Math.round((hora - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function CosturaInternaPage() {
  const [ops, setOps] = useState<OP[]>([]);
  const [producoes, setProducoes] = useState<ProducaoCelula[]>([]);
  const [celulas, setCelulas] = useState<Record<string, number>>({});
  const [filaOrdem, setFilaOrdem] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalIniciarOp, setModalIniciarOp] = useState<OP | null>(null);
  const [modalConcluirRow, setModalConcluirRow] = useState<ProducaoCelula | null>(null);
  const [modalCapacidadeAberto, setModalCapacidadeAberto] = useState(false);
  const { recolhido, alternar } = useHeaderRecolhido();

  const carregarOps = useCallback(async () => {
    try {
      const resp = await fetch("/api/ops", { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro ao carregar OPs");
      setOps(data.ops);
      setErro(null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarProducoes = useCallback(async () => {
    try {
      const resp = await fetch("/api/producao-celula", { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok) return;
      setProducoes(data.producoes || []);
    } catch {
      // informativo
    }
  }, []);

  const carregarCelulas = useCallback(async () => {
    try {
      const resp = await fetch("/api/celulas", { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok) return;
      setCelulas(data.celulas || {});
    } catch {
      // informativo
    }
  }, []);

  const carregarFila = useCallback(async () => {
    try {
      const resp = await fetch("/api/fila", { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok) return;
      setFilaOrdem((data.filas || {})[SETOR] || []);
    } catch {
      // informativo
    }
  }, []);

  const atualizarTudo = useCallback(() => {
    carregarOps();
    carregarProducoes();
    carregarCelulas();
    carregarFila();
  }, [carregarOps, carregarProducoes, carregarCelulas, carregarFila]);

  useEffect(() => {
    atualizarTudo();
    const interval = setInterval(atualizarTudo, REFRESH_MS);
    return () => clearInterval(interval);
  }, [atualizarTudo]);

  const opsCosturaInterna = useMemo(() => ops.filter((op) => op.setor === SETOR), [ops]);

  const emAndamentoPorOp = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const p of producoes) {
      if (p.status !== "em_andamento") continue;
      mapa[p.op_numero] = (mapa[p.op_numero] ?? 0) + p.quantidade;
    }
    return mapa;
  }, [producoes]);

  const filaEspera = useMemo(() => {
    const linhas = opsCosturaInterna
      .map((op) => ({ op, restante: (op.quantidade || 0) - (emAndamentoPorOp[op.op_numero] ?? 0) }))
      .filter((l) => l.restante > 0);
    const posicao = new Map(filaOrdem.map((chave, idx) => [chave, idx]));
    return linhas.sort((a, b) => {
      const pa = posicao.has(filaKey(a.op)) ? posicao.get(filaKey(a.op))! : Infinity;
      const pb = posicao.has(filaKey(b.op)) ? posicao.get(filaKey(b.op))! : Infinity;
      if (pa !== pb) return pa - pb;
      return b.restante - a.restante;
    });
  }, [opsCosturaInterna, emAndamentoPorOp, filaOrdem]);

  const emAndamentoRows = useMemo(
    () =>
      producoes
        .filter((p) => p.status === "em_andamento")
        .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime()),
    [producoes]
  );

  const concluidoRows = useMemo(
    () =>
      producoes
        .filter((p) => p.status === "concluido" && p.data_conclusao)
        .sort((a, b) => new Date(b.data_conclusao!).getTime() - new Date(a.data_conclusao!).getTime()),
    [producoes]
  );

  const concluidosHoje = useMemo(
    () => concluidoRows.filter((p) => p.data_conclusao && ehHoje(p.data_conclusao)),
    [concluidoRows]
  );
  const producaoHojeTotal = concluidosHoje.reduce((acc, p) => acc + p.quantidade_concluida, 0);
  const ultimaAtualizacaoHoje = concluidosHoje.length > 0 ? concluidosHoje[0].data_conclusao : null;
  const producaoPorCelulaHoje = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const p of concluidosHoje) mapa[p.celula] = (mapa[p.celula] ?? 0) + p.quantidade_concluida;
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [concluidosHoje]);

  // Curva de produção acumulada do dia (07h-19h) — degrau que sobe a cada
  // conclusão e fica horizontal quando não há produção registrada.
  const acumuladoDiaData = useMemo(() => {
    const eventos = concluidosHoje
      .filter((p) => p.data_conclusao)
      .map((p) => ({ t: new Date(p.data_conclusao!), qtd: p.quantidade_concluida }))
      .sort((a, b) => a.t.getTime() - b.t.getTime());

    const paraHoraFracionada = (d: Date) => Math.min(19, Math.max(7, d.getHours() + d.getMinutes() / 60));

    const pontos: { hora: number; acumulado: number }[] = [{ hora: 7, acumulado: 0 }];
    let acumulado = 0;
    for (const ev of eventos) {
      acumulado += ev.qtd;
      pontos.push({ hora: paraHoraFracionada(ev.t), acumulado });
    }
    const horaAtual = paraHoraFracionada(new Date());
    if (pontos[pontos.length - 1].hora < horaAtual) {
      pontos.push({ hora: horaAtual, acumulado });
    }
    return pontos;
  }, [concluidosHoje]);

  // Produção total por dia da semana atual (segunda a domingo), com o dia de
  // hoje destacado.
  const producaoSemana = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diaSemanaAtual = hoje.getDay(); // 0 = domingo
    const offsetParaSegunda = diaSemanaAtual === 0 ? -6 : 1 - diaSemanaAtual;
    const segunda = new Date(hoje);
    segunda.setDate(segunda.getDate() + offsetParaSegunda);

    const dias = DIAS_SEMANA.map((label, idx) => {
      const data = new Date(segunda);
      data.setDate(segunda.getDate() + idx);
      return { dia: label, data, total: 0, ehHoje: ehMesmoDia(data, hoje) };
    });

    for (const p of concluidoRows) {
      if (!p.data_conclusao) continue;
      const d = new Date(p.data_conclusao);
      const item = dias.find((i) => ehMesmoDia(i.data, d));
      if (item) item.total += p.quantidade_concluida;
    }
    return dias;
  }, [concluidoRows]);

  function persistirOrdem(novaOrdem: string[]) {
    setFilaOrdem(novaOrdem);
    fetch("/api/fila", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setor: SETOR, ordem: novaOrdem }),
    }).catch(() => {
      // se falhar, a próxima carregarFila() volta pro estado salvo no banco
    });
  }

  async function confirmarIniciar(op: OP, celula: string, tipoPeca: string[], quantidade: number) {
    try {
      const resp = await fetch("/api/producao-celula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opNumero: op.op_numero,
          codigo: op.codigo,
          produto: op.produto,
          celula,
          tipoPeca,
          quantidade,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro ao iniciar produção");
      setModalIniciarOp(null);
      carregarProducoes();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    }
  }

  async function confirmarConcluir(id: number, quantidade: number) {
    try {
      const resp = await fetch("/api/producao-celula", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acao: "concluir", quantidade }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro ao concluir");
      setModalConcluirRow(null);
      carregarProducoes();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    }
  }

  async function desfazerIniciar(id: number) {
    try {
      const resp = await fetch("/api/producao-celula", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro ao desfazer");
      carregarProducoes();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    }
  }

  async function desfazerConcluir(id: number) {
    try {
      const resp = await fetch("/api/producao-celula", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acao: "desfazer" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro ao desfazer");
      carregarProducoes();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    }
  }

  return (
    <div style={estilos.pagina}>
      <header style={{ ...estilos.header, ...(recolhido ? estilos.headerRecolhido : {}) }}>
        <div style={estilos.headerTopo}>
          <div>
            <h1 style={estilos.titulo}>Costura Interna</h1>
            {!recolhido && <p style={estilos.subtitulo}>Tela exclusiva do setor</p>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <a href="/" style={estilos.botao}>
              ← Kanban
            </a>
            <button onClick={() => setModalCapacidadeAberto(true)} style={estilos.botao}>
              Capacidade das Células
            </button>
            <button
              onClick={alternar}
              style={estilos.botaoRecolher}
              title={recolhido ? "Expandir cabeçalho" : "Recolher cabeçalho"}
            >
              {recolhido ? "▾" : "▴"}
            </button>
          </div>
        </div>
      </header>

      <main style={estilos.main}>
        {erro && (
          <div style={estilos.erroBox}>
            <strong>Erro:</strong> {erro}
          </div>
        )}

        <div style={estilos.indicadores}>
          <div style={estilos.indicadorCard}>
            <div style={estilos.indicadorTitulo}>Produção do Dia</div>
            <div style={estilos.indicadorValor}>{producaoHojeTotal.toLocaleString("pt-BR")} peças</div>
            <div style={estilos.indicadorRodape}>
              Última atualização:{" "}
              {ultimaAtualizacaoHoje ? formataDataHora(ultimaAtualizacaoHoje) : "nenhuma conclusão hoje ainda"}
            </div>
          </div>
          {producaoPorCelulaHoje.length === 0 ? (
            <div style={estilos.indicadorCard}>
              <div style={estilos.indicadorTitulo}>Produção por Célula</div>
              <div style={estilos.indicadorRodape}>Nenhuma conclusão hoje ainda</div>
            </div>
          ) : (
            producaoPorCelulaHoje.map(([celula, qtd]) => (
              <div key={celula} style={estilos.indicadorCard}>
                <div style={estilos.indicadorTitulo}>{celula}</div>
                <div style={estilos.indicadorValor}>{qtd.toLocaleString("pt-BR")} peças</div>
              </div>
            ))
          )}
        </div>

        {loading ? (
          <div style={estilos.estadoVazio}>Carregando...</div>
        ) : (
          <div style={estilos.conteudoPrincipal}>
            <div style={estilos.quadro}>
              <ColunaFilaEspera
                linhas={filaEspera}
                onReordenar={persistirOrdem}
                onIniciar={(op) => setModalIniciarOp(op)}
              />
              <ColunaSimples titulo="Em Andamento" total={emAndamentoRows.length}>
                {emAndamentoRows.length === 0 ? (
                  <div style={estilos.colunaVazia}>Sem produção em andamento</div>
                ) : (
                  emAndamentoRows.map((p) => (
                    <CardEmAndamento
                      key={p.id}
                      p={p}
                      onConcluir={() => setModalConcluirRow(p)}
                      onDesfazer={() => desfazerIniciar(p.id)}
                    />
                  ))
                )}
              </ColunaSimples>
              <ColunaSimples titulo="Concluído" total={concluidoRows.length}>
                {concluidoRows.length === 0 ? (
                  <div style={estilos.colunaVazia}>Nenhuma conclusão ainda</div>
                ) : (
                  concluidoRows.map((p) => (
                    <CardConcluido key={p.id} p={p} onDesfazer={() => desfazerConcluir(p.id)} />
                  ))
                )}
              </ColunaSimples>
            </div>

            <div style={estilos.graficosColuna}>
              <div style={{ ...estilos.graficoCard, flex: "2 1 0" }}>
                <div style={estilos.indicadorTitulo}>Produção Acumulada do Dia</div>
                <div style={estilos.graficoArea}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={acumuladoDiaData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="hora"
                        type="number"
                        domain={[7, 19]}
                        ticks={[7, 9, 11, 13, 15, 17, 19]}
                        tickFormatter={(h) => `${String(h).padStart(2, "0")}:00`}
                        fontSize={12}
                      />
                      <YAxis fontSize={12} allowDecimals={false} />
                      <Tooltip
                        labelFormatter={(h) => formataHoraFracionada(Number(h))}
                        formatter={(v) => `${Number(v).toLocaleString("pt-BR")} pç`}
                      />
                      <Line
                        type="monotone"
                        dataKey="acumulado"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#6366f1" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{ ...estilos.graficoCard, flex: "1 1 0" }}>
                <div style={estilos.indicadorTitulo}>Produção da Semana</div>
                <div style={estilos.graficoArea}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={producaoSemana} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="dia" fontSize={12} />
                      <YAxis fontSize={12} allowDecimals={false} />
                      <Tooltip formatter={(v) => `${Number(v).toLocaleString("pt-BR")} pç`} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {producaoSemana.map((d, i) => (
                          <Cell key={i} fill={d.ehHoje ? "#6366f1" : "#c7d2fe"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {modalIniciarOp && (
        <ModalIniciar
          op={modalIniciarOp}
          restante={filaEspera.find((l) => l.op.id === modalIniciarOp.id)?.restante ?? modalIniciarOp.quantidade}
          celulas={celulas}
          onFechar={() => setModalIniciarOp(null)}
          onConfirmar={confirmarIniciar}
        />
      )}

      {modalConcluirRow && (
        <ModalConcluir
          p={modalConcluirRow}
          onFechar={() => setModalConcluirRow(null)}
          onConfirmar={(quantidade) => confirmarConcluir(modalConcluirRow.id, quantidade)}
        />
      )}

      {modalCapacidadeAberto && (
        <ModalCapacidadeCelulas
          celulasIniciais={celulas}
          onFechar={() => setModalCapacidadeAberto(false)}
          onSalvo={(novas) => {
            setCelulas(novas);
            setModalCapacidadeAberto(false);
          }}
        />
      )}
    </div>
  );
}

function ColunaSimples({
  titulo,
  total,
  children,
}: {
  titulo: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div style={estilos.coluna}>
      <div style={estilos.colunaHeader}>
        <div style={estilos.colunaTitulo}>{titulo}</div>
        <span style={estilos.colunaBadge}>
          {total} {total === 1 ? "item" : "itens"}
        </span>
      </div>
      <div style={estilos.colunaCorpo}>{children}</div>
    </div>
  );
}

function ColunaFilaEspera({
  linhas,
  onReordenar,
  onIniciar,
}: {
  linhas: { op: OP; restante: number }[];
  onReordenar: (novaOrdem: string[]) => void;
  onIniciar: (op: OP) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const ativo = linhas.find((l) => filaKey(l.op) === activeId);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const chaves = linhas.map((l) => filaKey(l.op));
    const indiceAntigo = chaves.indexOf(String(active.id));
    const indiceNovo = chaves.indexOf(String(over.id));
    if (indiceAntigo === -1 || indiceNovo === -1) return;
    onReordenar(arrayMove(chaves, indiceAntigo, indiceNovo));
  }

  return (
    <div style={estilos.coluna}>
      <div style={estilos.colunaHeader}>
        <div style={estilos.colunaTitulo}>Fila de Espera</div>
        <span style={estilos.colunaBadge}>
          {linhas.length} {linhas.length === 1 ? "OP" : "OPs"}
        </span>
      </div>
      <div style={estilos.colunaCorpo}>
        {linhas.length === 0 ? (
          <div style={estilos.colunaVazia}>Sem OPs na fila</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={linhas.map((l) => filaKey(l.op))} strategy={verticalListSortingStrategy}>
              {linhas.map(({ op, restante }) => (
                <CardFilaEsperaSortable key={op.id} op={op} restante={restante} onIniciar={() => onIniciar(op)} />
              ))}
            </SortableContext>
            <DragOverlay>
              {ativo && <CardFilaEspera op={ativo.op} restante={ativo.restante} onIniciar={() => {}} isOverlay />}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function CardFilaEsperaSortable({
  op,
  restante,
  onIniciar,
}: {
  op: OP;
  restante: number;
  onIniciar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: filaKey(op),
  });
  return (
    <CardFilaEspera
      ref={setNodeRef}
      op={op}
      restante={restante}
      onIniciar={onIniciar}
      isDragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition: transition ?? "transform 200ms ease" }}
      {...attributes}
      {...listeners}
    />
  );
}

type CardFilaEsperaProps = React.HTMLAttributes<HTMLDivElement> & {
  op: OP;
  restante: number;
  onIniciar: () => void;
  isDragging?: boolean;
  isOverlay?: boolean;
};

const CardFilaEspera = forwardRef<HTMLDivElement, CardFilaEsperaProps>(function CardFilaEspera(
  { op, restante, onIniciar, isDragging, isOverlay, style, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      style={{
        ...estilos.card,
        ...(isDragging ? estilos.cardPlaceholder : {}),
        ...(isOverlay ? estilos.cardOverlay : {}),
        ...style,
      }}
      {...rest}
    >
      <div style={isDragging ? { opacity: 0 } : undefined}>
        <div style={estilos.cardTopo}>
          <span style={estilos.cardOp}>OP {op.op_numero}</span>
          <span style={estilos.cardQtde}>{restante.toLocaleString("pt-BR")} pç</span>
        </div>
        <div style={estilos.cardCodigo}>{op.codigo}</div>
        <div style={estilos.cardProduto}>{op.produto}</div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIniciar();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={estilos.botaoPlay}
          title="Iniciar produção"
        >
          ▶
        </button>
      </div>
    </div>
  );
});

function CardEmAndamento({
  p,
  onConcluir,
  onDesfazer,
}: {
  p: ProducaoCelula;
  onConcluir: () => void;
  onDesfazer: () => void;
}) {
  return (
    <div style={estilos.card}>
      <div style={estilos.cardTopo}>
        <span style={estilos.cardOp}>OP {p.op_numero}</span>
        <span style={estilos.cardQtde}>{p.quantidade.toLocaleString("pt-BR")} pç</span>
      </div>
      <div style={estilos.cardCodigo}>{p.codigo}</div>
      <div style={estilos.cardProduto}>{p.produto}</div>
      <div style={estilos.cardOficina}>
        Célula: <strong>{p.celula}</strong>
        {p.tipo_peca.length > 0 && ` · ${p.tipo_peca.map((t) => TIPOS_PECA.find((tp) => tp.valor === t)?.label ?? t).join(", ")}`}
      </div>
      <div style={estilos.cardRodape}>
        <span style={estilos.badgeCinza}>Iniciado {formataDataHora(p.data_inicio)}</span>
        {p.previsao_alvo && <span style={estilos.badgeAzul}>🎯 {formataPrevisao(new Date(p.previsao_alvo))}</span>}
      </div>
      <button onClick={onConcluir} style={estilos.botaoConcluir}>
        ✓ Concluir
      </button>
      <button onClick={onDesfazer} style={estilos.botaoDesfazer} title="Desfazer o início desta produção">
        desfazer início
      </button>
    </div>
  );
}

function CardConcluido({ p, onDesfazer }: { p: ProducaoCelula; onDesfazer: () => void }) {
  return (
    <div style={estilos.card}>
      <div style={estilos.cardTopo}>
        <span style={estilos.cardOp}>OP {p.op_numero}</span>
        <span style={estilos.cardQtde}>{p.quantidade_concluida.toLocaleString("pt-BR")} pç</span>
      </div>
      <div style={estilos.cardCodigo}>{p.codigo}</div>
      <div style={estilos.cardProduto}>{p.produto}</div>
      <div style={estilos.cardOficina}>
        Célula: <strong>{p.celula}</strong>
      </div>
      {p.data_conclusao && <span style={estilos.badgeVerde}>Concluído {formataDataHora(p.data_conclusao)}</span>}
      <button onClick={onDesfazer} style={estilos.botaoDesfazer} title="Desfazer a conclusão desta produção">
        desfazer conclusão
      </button>
    </div>
  );
}

function ModalIniciar({
  op,
  restante,
  celulas,
  onFechar,
  onConfirmar,
}: {
  op: OP;
  restante: number;
  celulas: Record<string, number>;
  onFechar: () => void;
  onConfirmar: (op: OP, celula: string, tipoPeca: string[], quantidade: number) => void;
}) {
  const [tipoPeca, setTipoPeca] = useState<string[]>([]);
  const [celula, setCelula] = useState("");
  const [quantidade, setQuantidade] = useState<number>(0);
  const nomesCelulas = Object.keys(celulas).sort();

  function toggleTipo(valor: string) {
    setTipoPeca((atual) => (atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor]));
  }

  function confirmar() {
    if (!celula || quantidade <= 0 || quantidade > restante) return;
    onConfirmar(op, celula, tipoPeca, quantidade);
  }

  return (
    <div style={estilos.modalFundo} onClick={onFechar}>
      <div style={estilos.modalCaixa} onClick={(e) => e.stopPropagation()}>
        <h2 style={estilos.modalTitulo}>Iniciar produção — OP {op.op_numero}</h2>
        <p style={estilos.modalSubtitulo}>
          {op.codigo} · {op.produto} · restam {restante.toLocaleString("pt-BR")} pç na fila
        </p>

        <label style={estilos.modalLabel}>Tipo de peça</label>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          {TIPOS_PECA.map((t) => (
            <label key={t.valor} style={estilos.checkboxLabel}>
              <input type="checkbox" checked={tipoPeca.includes(t.valor)} onChange={() => toggleTipo(t.valor)} />
              {t.label}
            </label>
          ))}
        </div>

        <label style={estilos.modalLabel}>Célula</label>
        <select value={celula} onChange={(e) => setCelula(e.target.value)} style={estilos.modalInput}>
          <option value="">Selecione...</option>
          {nomesCelulas.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label style={estilos.modalLabel}>Quantidade</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            min={1}
            max={restante}
            value={quantidade || ""}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            style={{ ...estilos.modalInput, flex: 1 }}
          />
          <button onClick={() => setQuantidade(restante)} style={estilos.botaoTotal}>
            Total
          </button>
        </div>

        <div style={estilos.modalBotoes}>
          <button onClick={onFechar} style={estilos.botaoSecundario}>
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!celula || quantidade <= 0 || quantidade > restante}
            style={estilos.botaoPrimario}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalConcluir({
  p,
  onFechar,
  onConfirmar,
}: {
  p: ProducaoCelula;
  onFechar: () => void;
  onConfirmar: (quantidade: number) => void;
}) {
  const [quantidade, setQuantidade] = useState<number>(0);
  const valido = quantidade > 0 && quantidade <= p.quantidade;

  function confirmar() {
    if (!valido) return;
    onConfirmar(quantidade);
  }

  return (
    <div style={estilos.modalFundo} onClick={onFechar}>
      <div style={estilos.modalCaixa} onClick={(e) => e.stopPropagation()}>
        <h2 style={estilos.modalTitulo}>Concluir produção — OP {p.op_numero}</h2>
        <p style={estilos.modalSubtitulo}>
          {p.codigo} · {p.produto} · Célula {p.celula} · {p.quantidade.toLocaleString("pt-BR")} pç em andamento
        </p>

        <label style={estilos.modalLabel}>Quantidade concluída</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            min={1}
            max={p.quantidade}
            value={quantidade || ""}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            style={{ ...estilos.modalInput, flex: 1 }}
          />
          <button onClick={() => setQuantidade(p.quantidade)} style={estilos.botaoTotal}>
            Tudo
          </button>
        </div>

        <div style={estilos.modalBotoes}>
          <button onClick={onFechar} style={estilos.botaoSecundario}>
            Cancelar
          </button>
          <button onClick={confirmar} disabled={!valido} style={estilos.botaoPrimario}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalCapacidadeCelulas({
  celulasIniciais,
  onFechar,
  onSalvo,
}: {
  celulasIniciais: Record<string, number>;
  onFechar: () => void;
  onSalvo: (novas: Record<string, number>) => void;
}) {
  const [celulas, setCelulas] = useState<Record<string, number>>(celulasIniciais);
  const [removidas, setRemovidas] = useState<Set<string>>(new Set());
  const [novaCelula, setNovaCelula] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function adicionar() {
    const nome = novaCelula.trim();
    if (!nome || nome in celulas) return;
    setCelulas({ ...celulas, [nome]: 0 });
    setNovaCelula("");
  }

  function remover(nome: string) {
    const copia = { ...celulas };
    delete copia[nome];
    setCelulas(copia);
    setRemovidas((atual) => new Set(atual).add(nome));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const resp = await fetch("/api/celulas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celulas, remover: Array.from(removidas) }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro ao salvar");
      onSalvo(celulas);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={estilos.modalFundo} onClick={onFechar}>
      <div style={estilos.modalCaixa} onClick={(e) => e.stopPropagation()}>
        <h2 style={estilos.modalTitulo}>Capacidade das Células</h2>
        {erro && <div style={estilos.erroBox}>{erro}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {Object.keys(celulas)
            .sort()
            .map((celula) => (
              <div key={celula} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{celula}</span>
                <input
                  type="number"
                  min={0}
                  value={celulas[celula] ?? 0}
                  onChange={(e) => setCelulas({ ...celulas, [celula]: Number(e.target.value) })}
                  style={{ ...estilos.modalInput, width: 100 }}
                />
                <button onClick={() => remover(celula)} style={estilos.botaoRemover} title="Remover">
                  ×
                </button>
              </div>
            ))}
          {Object.keys(celulas).length === 0 && (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Nenhuma célula cadastrada ainda.</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={novaCelula}
            onChange={(e) => setNovaCelula(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            placeholder="Nome da nova célula"
            style={{ ...estilos.modalInput, flex: 1 }}
          />
          <button onClick={adicionar} style={estilos.botaoSecundario}>
            + Adicionar
          </button>
        </div>
        <div style={estilos.modalBotoes}>
          <button onClick={onFechar} style={estilos.botaoSecundario}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} style={estilos.botaoPrimario}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  pagina: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    flexShrink: 0,
    background: "#14142b",
    color: "#fff",
    padding: "20px 24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  headerRecolhido: {
    padding: "10px 24px",
  },
  botaoRecolher: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 8,
    width: 34,
    padding: "8px 0",
    fontSize: 13,
    cursor: "pointer",
    color: "#fff",
  },
  main: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    padding: "20px 24px 24px",
    overflow: "hidden",
  },
  headerTopo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  titulo: { margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.3 },
  subtitulo: { margin: "2px 0 0", fontSize: 13, color: "#a5a6c9", fontWeight: 500 },
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
  },
  erroBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13.5,
  },
  indicadores: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 14,
    flexShrink: 0,
  },
  indicadorCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "16px 20px",
    minWidth: 0,
  },
  indicadorTitulo: { fontSize: 12.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" },
  indicadorValor: { fontSize: 30, fontWeight: 800, color: "#111827", marginTop: 6 },
  indicadorRodape: { fontSize: 12, color: "#9ca3af", marginTop: 8 },
  estadoVazio: { textAlign: "center", padding: 60, color: "#6b7280", fontSize: 14 },
  conteudoPrincipal: {
    display: "flex",
    gap: 14,
    flex: 1,
    minHeight: 0,
  },
  quadro: {
    display: "flex",
    gap: 14,
    flex: 1,
    minHeight: 0,
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: 12,
    alignItems: "stretch",
  },
  graficosColuna: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    flex: 1,
    minWidth: 0,
    paddingBottom: 12,
  },
  graficoCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "16px 20px",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  graficoArea: {
    flex: 1,
    minHeight: 0,
    marginTop: 8,
  },
  coluna: {
    minWidth: 280,
    maxWidth: 280,
    background: "#eceef2",
    borderRadius: 12,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  colunaHeader: {
    padding: "12px 12px 10px",
    borderBottom: "1px solid #dde0e6",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  colunaTitulo: {
    fontWeight: 700,
    fontSize: 13,
    color: "#1f2937",
    textTransform: "uppercase",
    letterSpacing: 0.3,
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
  colunaCorpo: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 10,
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
  },
  colunaVazia: { textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "16px 0" },
  card: {
    background: "#fff",
    borderRadius: 8,
    borderLeft: "4px solid #9ca3af",
    padding: "10px 12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    fontSize: 12.5,
    touchAction: "none",
  },
  cardPlaceholder: {
    background: "#eef2ff",
    border: "2px dashed #a5b4fc",
    borderLeft: "2px dashed #a5b4fc",
    boxShadow: "none",
  },
  cardOverlay: {
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
    opacity: 0.95,
    cursor: "grabbing",
    transform: "scale(1.03) rotate(-1.5deg)",
  },
  cardTopo: { display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#111827" },
  cardOp: {},
  cardQtde: { color: "#4b5563", fontWeight: 600 },
  cardCodigo: { color: "#374151", marginTop: 3, fontWeight: 500 },
  cardProduto: { color: "#6b7280", marginTop: 2, lineHeight: 1.35 },
  cardOficina: { color: "#4b5563", marginTop: 6, fontSize: 12 },
  cardRodape: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8 },
  badgeCinza: {
    fontSize: 10.5,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 999,
    background: "#f3f4f6",
    color: "#6b7280",
  },
  badgeAzul: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#4338ca",
  },
  badgeVerde: {
    display: "inline-block",
    marginTop: 8,
    fontSize: 10.5,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
  },
  botaoPlay: {
    marginTop: 8,
    width: "100%",
    background: "#dcfce7",
    color: "#16a34a",
    border: "1px solid #86efac",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  botaoConcluir: {
    marginTop: 8,
    width: "100%",
    background: "#eef2ff",
    color: "#4338ca",
    border: "1px solid #c7d2fe",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  botaoDesfazer: {
    marginTop: 6,
    width: "100%",
    background: "transparent",
    border: "none",
    padding: "2px 0",
    fontSize: 10.5,
    color: "#9ca3af",
    cursor: "pointer",
    textDecoration: "underline",
  },
  modalFundo: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 16,
  },
  modalCaixa: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalTitulo: { margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "#111827" },
  modalSubtitulo: { margin: "0 0 16px", fontSize: 12.5, color: "#6b7280" },
  modalLabel: { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 10 },
  modalInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13.5,
  },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13 },
  botaoTotal: {
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "8px 14px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  modalBotoes: { display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" },
  botaoSecundario: {
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "9px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    color: "#1a1a2e",
  },
  botaoPrimario: {
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "9px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  botaoRemover: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "none",
    borderRadius: 6,
    width: 30,
    height: 30,
    fontSize: 16,
    cursor: "pointer",
    flexShrink: 0,
  },
};
