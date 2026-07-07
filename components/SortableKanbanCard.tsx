import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { OP } from "@/lib/types";
import { KanbanCard } from "./KanbanCard";

type Props = {
  id: string;
  op: OP;
  cor: string;
  dias: number | null;
  previsao: Date | null;
  mostrarOficina: boolean;
  dataInicio?: string | null;
  onIniciar?: () => void;
  onDesfazerInicio?: () => void;
};

export function SortableKanbanCard({
  id,
  op,
  cor,
  dias,
  previsao,
  mostrarOficina,
  dataInicio,
  onIniciar,
  onDesfazerInicio,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <KanbanCard
      ref={setNodeRef}
      op={op}
      cor={cor}
      dias={dias}
      previsao={previsao}
      mostrarOficina={mostrarOficina}
      isDragging={isDragging}
      dataInicio={dataInicio}
      onIniciar={onIniciar}
      onDesfazerInicio={onDesfazerInicio}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 200ms ease",
      }}
      {...attributes}
      {...listeners}
    />
  );
}
