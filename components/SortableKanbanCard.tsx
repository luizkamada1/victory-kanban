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
};

export function SortableKanbanCard({ id, op, cor, dias, previsao, mostrarOficina }: Props) {
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
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 200ms ease",
      }}
      {...attributes}
      {...listeners}
    />
  );
}
