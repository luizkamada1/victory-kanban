import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { OP } from "@/lib/types";
import { KanbanCard } from "./KanbanCard";

type Props = {
  id: string;
  op: OP;
  cor: string;
  dias: number | null;
  mostrarOficina: boolean;
  emAndamento?: boolean;
  dataAlvo?: Date | null;
};

export function SortableKanbanCard({ id, op, cor, dias, mostrarOficina, emAndamento, dataAlvo }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <KanbanCard
      ref={setNodeRef}
      op={op}
      cor={cor}
      dias={dias}
      mostrarOficina={mostrarOficina}
      isDragging={isDragging}
      emAndamento={emAndamento}
      dataAlvo={dataAlvo}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 200ms ease",
      }}
      {...attributes}
      {...listeners}
    />
  );
}
