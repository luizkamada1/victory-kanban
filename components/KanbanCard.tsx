import { forwardRef } from "react";
import type { OP } from "@/lib/types";
import { abreviaOficina, formataPrevisao, formataDataHora, estaAtrasada } from "@/lib/kanban-utils";

type KanbanCardProps = React.HTMLAttributes<HTMLDivElement> & {
  op: OP;
  cor: string;
  dias: number | null;
  previsao: Date | null;
  mostrarOficina: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  dataInicio?: string | null;
  onIniciar?: () => void;
  onDesfazerInicio?: () => void;
};

export const KanbanCard = forwardRef<HTMLDivElement, KanbanCardProps>(function KanbanCard(
  { op, cor, dias, previsao, mostrarOficina, isDragging, isOverlay, dataInicio, onIniciar, onDesfazerInicio, style, ...rest },
  ref
) {
  const atrasada = previsao !== null && !!dataInicio && estaAtrasada(previsao);
  return (
    <div
      ref={ref}
      style={{
        ...estilos.card,
        borderLeftColor: cor,
        ...(isDragging ? estilos.cardPlaceholder : {}),
        ...(isOverlay ? estilos.cardOverlay : {}),
        ...style,
      }}
      {...rest}
    >
      {/* Mantém o conteúdo no DOM (mesma altura), só fica invisível — é o que
          vira o "espaço vazio" indicando onde o card vai ser inserido. */}
      <div style={isDragging ? estilos.conteudoInvisivel : undefined}>
        <div style={estilos.cardTopo}>
          <span style={estilos.cardOp}>OP {op.op_numero}</span>
          <span style={estilos.cardQtde}>{op.quantidade.toLocaleString("pt-BR")} pç</span>
        </div>
        <div style={estilos.cardCodigo}>{op.codigo}</div>
        <div style={estilos.cardProduto}>{op.produto}</div>
        {mostrarOficina && op.oficina && (
          <div style={estilos.cardOficina}>
            Oficina: <strong>{abreviaOficina(op.oficina)}</strong>
          </div>
        )}
        <div style={estilos.cardRodape}>
          {dias !== null && (
            <span style={{ ...estilos.cardDias, color: cor, background: cor + "1a" }}>
              {dias === 0 ? "Entrou hoje" : `${dias} dia${dias > 1 ? "s" : ""} no setor`}
            </span>
          )}
          {previsao && !dataInicio && (
            <span style={estilos.cardPrevisaoEstimativa} title="Estimativa de conclusão (ainda não iniciada)">
              🏁 {formataPrevisao(previsao)}
            </span>
          )}
          {previsao && dataInicio && !atrasada && (
            <span style={estilos.cardPrevisaoReal} title="Previsão de conclusão a partir do início real">
              🎯 {formataPrevisao(previsao)}
            </span>
          )}
          {previsao && dataInicio && atrasada && (
            <span style={estilos.cardPrevisaoAtrasada} title="Previsão de conclusão a partir do início real">
              ⚠ Atrasada — previsto {formataPrevisao(previsao)}
            </span>
          )}
        </div>
        {dataInicio ? (
          <div style={estilos.inicioLinha}>
            <span style={estilos.inicioTexto}>▶ Iniciado em {formataDataHora(dataInicio)}</span>
            {onDesfazerInicio && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDesfazerInicio();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={estilos.desfazerBotao}
                title="Desfazer início de produção"
              >
                desfazer
              </button>
            )}
          </div>
        ) : (
          onIniciar &&
          !isOverlay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onIniciar();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={estilos.iniciarBotao}
            >
              ▶ Iniciar
            </button>
          )
        )}
      </div>
    </div>
  );
});

const estilos: Record<string, React.CSSProperties> = {
  card: {
    background: "#fff",
    borderRadius: 8,
    borderLeft: "4px solid #9ca3af",
    padding: "10px 12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    fontSize: 12.5,
    touchAction: "none",
    cursor: "grab",
  },
  cardPlaceholder: {
    background: "#eef2ff",
    border: "2px dashed #a5b4fc",
    borderLeft: "2px dashed #a5b4fc",
    boxShadow: "none",
  },
  conteudoInvisivel: {
    opacity: 0,
  },
  cardOverlay: {
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
    opacity: 0.95,
    cursor: "grabbing",
    transform: "scale(1.03) rotate(-1.5deg)",
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
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    display: "inline-block",
  },
  cardRodape: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    marginTop: 8,
  },
  cardPrevisao: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    display: "inline-block",
    background: "#eef2ff",
    color: "#4338ca",
  },
  cardPrevisaoEstimativa: {
    fontSize: 10.5,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 999,
    display: "inline-block",
    background: "#f3f4f6",
    color: "#6b7280",
    fontStyle: "italic",
  },
  cardPrevisaoReal: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    display: "inline-block",
    background: "#eef2ff",
    color: "#4338ca",
  },
  cardPrevisaoAtrasada: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    display: "inline-block",
    background: "#fee2e2",
    color: "#dc2626",
  },
  inicioLinha: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px dashed #e5e7eb",
  },
  inicioTexto: {
    fontSize: 10.5,
    color: "#16a34a",
    fontWeight: 600,
  },
  desfazerBotao: {
    background: "transparent",
    border: "none",
    padding: 0,
    fontSize: 10,
    color: "#9ca3af",
    cursor: "pointer",
    textDecoration: "underline",
    flexShrink: 0,
  },
  iniciarBotao: {
    marginTop: 8,
    width: "100%",
    background: "#eef2ff",
    color: "#4338ca",
    border: "1px solid #c7d2fe",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
};
