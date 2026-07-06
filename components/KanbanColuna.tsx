import { useState } from "react";
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
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { OP } from "@/lib/types";
import { SETORES_COM_OFICINA, SETORES_COM_CAPACIDADE } from "@/lib/setores";
import {
  diasNoSetor,
  corAlerta,
  corOcupacao,
  abreviaOficina,
  filaKey,
  addDias,
} from "@/lib/kanban-utils";
import { KanbanCard } from "./KanbanCard";
import { SortableKanbanCard } from "./SortableKanbanCard";

type Props = {
  setor: string;
  cards: OP[];
  capacidadeSetores: Record<string, number>;
  capacidadeOficinas: Record<string, number>;
  oficinasVisiveis: boolean;
  onToggleOficinasVisiveis: () => void;
  onReordenar: (setor: string, novaOrdemChaves: string[]) => void;
};

export function KanbanColuna({
  setor,
  cards,
  capacidadeSetores,
  capacidadeOficinas,
  oficinasVisiveis,
  onToggleOficinasVisiveis,
  onReordenar,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const totalPecasSetor = cards.reduce((acc, op) => acc + (op.quantidade || 0), 0);
  const mostrarOficina = SETORES_COM_OFICINA.includes(setor);

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
    capacidadeSetor !== null && capacidadeSetor > 0 ? (totalPecasSetor / capacidadeSetor) * 100 : null;
  const diasServico =
    capacidadeSetor !== null && capacidadeSetor > 0 ? totalPecasSetor / capacidadeSetor : null;
  const corOcup = corOcupacao(ocupacao);

  const breakdownOficinas =
    setor === "COSTURA EXTERNA"
      ? Array.from(new Set(cards.map((op) => op.oficina).filter(Boolean) as string[]))
          .map((oficina) => {
            const totalOficina = cards
              .filter((op) => op.oficina === oficina)
              .reduce((acc, op) => acc + (op.quantidade || 0), 0);
            const capOficina = capacidadeOficinas[oficina] ?? 0;
            const ocupOficina = capOficina > 0 ? (totalOficina / capOficina) * 100 : null;
            const diasOficina = capOficina > 0 ? totalOficina / capOficina : null;
            return { oficina, totalOficina, capOficina, ocupOficina, diasOficina };
          })
          .sort((a, b) => (b.ocupOficina ?? -1) - (a.ocupOficina ?? -1))
      : [];

  // Calcula cor/dias/previsão de cada card na ordem atual de exibição.
  let acumuladoColuna = 0;
  const acumuladoPorOficina: Record<string, number> = {};
  const cardsComputados = cards.map((op) => {
    const dias = diasNoSetor(op.data_envio_fase);
    const cor = corAlerta(dias);

    let previsao: Date | null = null;
    if (setor === "COSTURA EXTERNA" && op.oficina) {
      const capOf = capacidadeOficinas[op.oficina] ?? 0;
      acumuladoPorOficina[op.oficina] = (acumuladoPorOficina[op.oficina] ?? 0) + (op.quantidade || 0);
      if (capOf > 0) {
        previsao = addDias(new Date(), Math.ceil(acumuladoPorOficina[op.oficina] / capOf));
      }
    } else if (capacidadeSetor !== null && capacidadeSetor > 0) {
      acumuladoColuna += op.quantidade || 0;
      previsao = addDias(new Date(), Math.ceil(acumuladoColuna / capacidadeSetor));
    }

    return { op, chave: filaKey(op), cor, dias, previsao };
  });

  const cardAtivo = cardsComputados.find((c) => c.chave === activeId);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const chaves = cards.map(filaKey);
    const indiceAntigo = chaves.indexOf(String(active.id));
    const indiceNovo = chaves.indexOf(String(over.id));
    if (indiceAntigo === -1 || indiceNovo === -1) return;
    onReordenar(setor, arrayMove(chaves, indiceAntigo, indiceNovo));
  }

  return (
    <div style={estilos.coluna}>
      <div style={estilos.colunaHeader}>
        <div style={estilos.colunaTitulo}>{setor}</div>
        <div style={estilos.colunaStats}>
          <span style={estilos.colunaBadge}>
            {cards.length} OP{cards.length === 1 ? "" : "s"}
          </span>
          <span style={estilos.colunaBadge}>{totalPecasSetor.toLocaleString("pt-BR")} pç</span>
        </div>
        {ocupacao !== null && (
          <div style={{ ...estilos.capacidadeBox, borderColor: corOcup }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ ...estilos.capacidadePercent, color: corOcup }}>
                {ocupacao.toFixed(0)}% de ocupação
              </span>
              {ocupacao >= 100 && <span style={{ fontSize: 12 }}>⚠️</span>}
            </div>
            <span style={estilos.capacidadeDiaria}>
              Capacidade: {capacidadeSetor!.toLocaleString("pt-BR")} pç/dia
            </span>
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
        {breakdownOficinas.length > 0 && (
          <>
            <button onClick={onToggleOficinasVisiveis} style={estilos.oficinasToggle}>
              {oficinasVisiveis ? "▾" : "▸"} Oficinas ({breakdownOficinas.length})
            </button>
            {oficinasVisiveis && (
              <div style={estilos.oficinasBreakdown}>
                {breakdownOficinas.map(({ oficina, totalOficina, capOficina, ocupOficina, diasOficina }) => {
                  const corOf = corOcupacao(ocupOficina);
                  return (
                    <div key={oficina} style={estilos.oficinaLinha}>
                      <div style={estilos.oficinaLinhaTopo}>
                        <span style={estilos.oficinaNome} title={oficina}>
                          {abreviaOficina(oficina)}
                        </span>
                        <span style={{ color: corOf, fontWeight: 700 }}>
                          {ocupOficina !== null ? `${ocupOficina.toFixed(0)}%` : "s/ capacidade"}
                        </span>
                      </div>
                      <div style={estilos.oficinaLinhaBaixo}>
                        <span>
                          {totalOficina.toLocaleString("pt-BR")}
                          {capOficina > 0 ? ` / ${capOficina.toLocaleString("pt-BR")}` : ""} pç
                        </span>
                        {diasOficina !== null && (
                          <span>
                            ≈ {diasOficina.toFixed(1)} dia{diasOficina >= 2 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <div style={estilos.colunaCorpo}>
        {cardsComputados.length === 0 ? (
          <div style={estilos.colunaVazia}>Sem OPs</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext
              items={cardsComputados.map((c) => c.chave)}
              strategy={verticalListSortingStrategy}
            >
              {cardsComputados.map(({ op, chave, cor, dias, previsao }) => (
                <SortableKanbanCard
                  key={op.id}
                  id={chave}
                  op={op}
                  cor={cor}
                  dias={dias}
                  previsao={previsao}
                  mostrarOficina={mostrarOficina}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {cardAtivo && (
                <KanbanCard
                  op={cardAtivo.op}
                  cor={cardAtivo.cor}
                  dias={cardAtivo.dias}
                  previsao={cardAtivo.previsao}
                  mostrarOficina={mostrarOficina}
                  isOverlay
                />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  coluna: {
    minWidth: 270,
    maxWidth: 270,
    background: "#eceef2",
    borderRadius: 12,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100vh - 170px)",
    overflow: "hidden",
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
    borderWidth: 1,
    borderStyle: "solid",
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
  capacidadeDiaria: {
    display: "block",
    marginTop: 2,
    fontSize: 10.5,
    color: "#9ca3af",
    fontWeight: 500,
  },
  capacidadeDias: {
    display: "block",
    marginTop: 5,
    fontSize: 11,
    color: "#6b7280",
    fontWeight: 500,
  },
  oficinasToggle: {
    marginTop: 8,
    background: "transparent",
    border: "none",
    padding: 0,
    fontSize: 11.5,
    fontWeight: 700,
    color: "#4b5563",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  oficinasBreakdown: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 5,
    maxHeight: 420,
    overflowY: "auto",
  },
  oficinaLinha: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "5px 8px",
  },
  oficinaLinhaTopo: {
    display: "flex",
    justifyContent: "space-between",
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    color: "#1f2937",
  },
  oficinaNome: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  oficinaLinhaBaixo: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10.5,
    color: "#9ca3af",
    marginTop: 2,
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
  colunaVazia: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
    padding: "16px 0",
  },
};
