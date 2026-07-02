export type OP = {
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
