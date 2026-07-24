"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  ComposedChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { OP } from "@/lib/types";
import { SETORES_ORDEM } from "@/lib/setores";
import { diasNoSetor, corOcupacao, abreviaOficina, diasUteisNoPeriodo } from "@/lib/kanban-utils";

type HistoricoLinha = { data: string; setor: string; total_ops: number; total_pecas: number };
type LeadTimeSetor = { setor: string; mediaDias: number; amostras: number };

const CORES_SERIE = [
  "#6366f1",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#0ea5e9",
  "#a855f7",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#64748b",
  "#eab308",
  "#8b5cf6",
];

function formataDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

// Ordem oficial do fluxo de produção pros gráficos que comparam setores.
const ORDEM_SETORES_GRAFICO = [
  "CORTE",
  "ETIQUETAÇÃO",
  "BORDADO",
  "ESTAMPA",
  "COSTURA INTERNA",
  "COSTURA EXTERNA",
  "ACABAMENTO",
];

// Setores de retrabalho (RET. CORTE, RET. COSTURA, etc.) ficam fora dos
// gráficos do dashboard.
function éSetorRetrabalho(setor: string): boolean {
  return /^ret[.\s]/i.test(setor.trim());
}

function ordenarPorSetor<T extends { setor: string }>(itens: T[]): T[] {
  return itens
    .filter((item) => !éSetorRetrabalho(item.setor))
    .sort((a, b) => {
      const ia = ORDEM_SETORES_GRAFICO.indexOf(a.setor);
      const ib = ORDEM_SETORES_GRAFICO.indexOf(b.setor);
      const pa = ia === -1 ? 999 : ia;
      const pb = ib === -1 ? 999 : ib;
      if (pa !== pb) return pa - pb;
      return a.setor.localeCompare(b.setor);
    });
}

// Mesma cor pro mesmo setor em todos os gráficos (linha em "Evolução de peças
// por setor" e barras nos demais).
function corDoSetor(setor: string): string {
  const idx = ORDEM_SETORES_GRAFICO.indexOf(setor);
  if (idx === -1) return "#64748b";
  return CORES_SERIE[idx % CORES_SERIE.length];
}

function TituloGrafico({ titulo, dica }: { titulo: string; dica: string }) {
  return (
    <div>
      <h2 style={estilos.cardTitulo}>{titulo}</h2>
      <p style={estilos.dicaTexto}>{dica}</p>
    </div>
  );
}

type PresetPeriodo = "hoje" | "semana" | "mes" | "mesPassado" | "personalizado";

function calcularPeriodo(preset: PresetPeriodo): { inicio: string; fim: string } {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);
  if (preset === "hoje") return { inicio: hojeStr, fim: hojeStr };
  if (preset === "semana") {
    const diaSemana = hoje.getDay(); // 0 = domingo
    const diffParaSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() - diffParaSegunda);
    return { inicio: segunda.toISOString().slice(0, 10), fim: hojeStr };
  }
  if (preset === "mes") {
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { inicio: primeiro.toISOString().slice(0, 10), fim: hojeStr };
  }
  if (preset === "mesPassado") {
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return { inicio: primeiro.toISOString().slice(0, 10), fim: ultimo.toISOString().slice(0, 10) };
  }
  return { inicio: hojeStr, fim: hojeStr }; // personalizado: valor inicial, depois o usuário ajusta
}

function FiltroPeriodo({
  preset,
  inicio,
  fim,
  onPreset,
  onInicio,
  onFim,
}: {
  preset: PresetPeriodo;
  inicio: string;
  fim: string;
  onPreset: (p: PresetPeriodo) => void;
  onInicio: (v: string) => void;
  onFim: (v: string) => void;
}) {
  return (
    <div style={estilos.filtroPeriodo}>
      <label style={estilos.filtroPeriodoLabel}>
        Período
        <select
          value={preset}
          onChange={(e) => onPreset(e.target.value as PresetPeriodo)}
          style={estilos.filtroPeriodoInput}
        >
          <option value="hoje">Hoje</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mês</option>
          <option value="mesPassado">Mês passado</option>
          <option value="personalizado">Personalizado</option>
        </select>
      </label>
      {preset === "personalizado" && (
        <>
          <label style={estilos.filtroPeriodoLabel}>
            De
            <input
              type="date"
              value={inicio}
              max={fim}
              onChange={(e) => onInicio(e.target.value)}
              style={estilos.filtroPeriodoInput}
            />
          </label>
          <label style={estilos.filtroPeriodoLabel}>
            Até
            <input
              type="date"
              value={fim}
              min={inicio}
              onChange={(e) => onFim(e.target.value)}
              style={estilos.filtroPeriodoInput}
            />
          </label>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [ops, setOps] = useState<OP[]>([]);
  const [capacidadeSetores, setCapacidadeSetores] = useState<Record<string, number>>({});
  const [capacidadeOficinas, setCapacidadeOficinas] = useState<Record<string, number>>({});
  const [historico, setHistorico] = useState<HistoricoLinha[]>([]);
  const [leadTimePorSetor, setLeadTimePorSetor] = useState<LeadTimeSetor[]>([]);
  const [leadTimeGeral, setLeadTimeGeral] = useState<number | null>(null);
  const [amostrasGeral, setAmostrasGeral] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [presetLead, setPresetLead] = useState<PresetPeriodo>("mes");
  const [leadInicio, setLeadInicio] = useState(() => calcularPeriodo("mes").inicio);
  const [leadFim, setLeadFim] = useState(() => calcularPeriodo("mes").fim);
  const [carregandoLead, setCarregandoLead] = useState(false);
  const [erroLead, setErroLead] = useState<string | null>(null);

  function mudarPresetLead(p: PresetPeriodo) {
    setPresetLead(p);
    if (p === "personalizado") return;
    const { inicio, fim } = calcularPeriodo(p);
    setLeadInicio(inicio);
    setLeadFim(fim);
  }

  const [presetProducao, setPresetProducao] = useState<PresetPeriodo>("mes");
  const [periodoInicio, setPeriodoInicio] = useState(() => calcularPeriodo("mes").inicio);
  const [periodoFim, setPeriodoFim] = useState(() => calcularPeriodo("mes").fim);
  const [producaoPeriodo, setProducaoPeriodo] = useState<
    { setor: string; pecas: number; ops: number }[]
  >([]);
  const [carregandoProducao, setCarregandoProducao] = useState(false);
  const [erroProducao, setErroProducao] = useState<string | null>(null);

  function mudarPresetProducao(p: PresetPeriodo) {
    setPresetProducao(p);
    if (p === "personalizado") return;
    const { inicio, fim } = calcularPeriodo(p);
    setPeriodoInicio(inicio);
    setPeriodoFim(fim);
  }

  const [setoresEvolucaoDiaria, setSetoresEvolucaoDiaria] = useState<Set<string>>(
    new Set(ORDEM_SETORES_GRAFICO)
  );
  const [mostrarSeletorEvolucaoDiaria, setMostrarSeletorEvolucaoDiaria] = useState(false);
  const [presetEvolucao, setPresetEvolucao] = useState<PresetPeriodo>("mes");
  const [evolucaoInicio, setEvolucaoInicio] = useState(() => calcularPeriodo("mes").inicio);
  const [evolucaoFim, setEvolucaoFim] = useState(() => calcularPeriodo("mes").fim);
  const [producaoDiariaSetor, setProducaoDiariaSetor] = useState<Record<string, string | number>[]>(
    []
  );
  const [setoresComDadosDiaria, setSetoresComDadosDiaria] = useState<string[]>([]);
  const [carregandoProducaoDiaria, setCarregandoProducaoDiaria] = useState(false);
  const [erroProducaoDiaria, setErroProducaoDiaria] = useState<string | null>(null);

  function toggleSetorEvolucaoDiaria(setor: string) {
    setSetoresEvolucaoDiaria((atual) => {
      const novo = new Set(atual);
      if (novo.has(setor)) novo.delete(setor);
      else novo.add(setor);
      return novo;
    });
  }

  function mudarPresetEvolucao(p: PresetPeriodo) {
    setPresetEvolucao(p);
    if (p === "personalizado") return;
    const { inicio, fim } = calcularPeriodo(p);
    setEvolucaoInicio(inicio);
    setEvolucaoFim(fim);
  }

  const [presetEvolTotal, setPresetEvolTotal] = useState<PresetPeriodo>("mes");
  const [evolTotalInicio, setEvolTotalInicio] = useState(() => calcularPeriodo("mes").inicio);
  const [evolTotalFim, setEvolTotalFim] = useState(() => calcularPeriodo("mes").fim);
  function mudarPresetEvolTotal(p: PresetPeriodo) {
    setPresetEvolTotal(p);
    if (p === "personalizado") return;
    const { inicio, fim } = calcularPeriodo(p);
    setEvolTotalInicio(inicio);
    setEvolTotalFim(fim);
  }

  const [presetEvolSetor, setPresetEvolSetor] = useState<PresetPeriodo>("mes");
  const [evolSetorInicio, setEvolSetorInicio] = useState(() => calcularPeriodo("mes").inicio);
  const [evolSetorFim, setEvolSetorFim] = useState(() => calcularPeriodo("mes").fim);
  function mudarPresetEvolSetor(p: PresetPeriodo) {
    setPresetEvolSetor(p);
    if (p === "personalizado") return;
    const { inicio, fim } = calcularPeriodo(p);
    setEvolSetorInicio(inicio);
    setEvolSetorFim(fim);
  }
  const [setoresSelecionados, setSetoresSelecionados] = useState<Set<string> | null>(null);
  const [mostrarSeletorSetores, setMostrarSeletorSetores] = useState(false);
  function toggleSetorSelecionado(setor: string, todosPresentes: string[]) {
    setSetoresSelecionados((atual) => {
      const base = atual ?? new Set(todosPresentes);
      const novo = new Set(base);
      if (novo.has(setor)) novo.delete(setor);
      else novo.add(setor);
      return novo;
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const [opsResp, capResp, histResp] = await Promise.all([
          fetch("/api/ops", { cache: "no-store" }),
          fetch("/api/capacidade", { cache: "no-store" }),
          fetch("/api/historico", { cache: "no-store" }),
        ]);
        const opsData = await opsResp.json();
        if (!opsResp.ok) throw new Error(opsData.error || "Erro ao carregar OPs");
        setOps(opsData.ops);

        const capData = await capResp.json();
        if (capResp.ok) {
          setCapacidadeSetores(capData.setores || {});
          setCapacidadeOficinas(capData.oficinas || {});
        }

        const histData = await histResp.json();
        if (histResp.ok) setHistorico(histData.historico || []);
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setCarregandoLead(true);
      setErroLead(null);
      try {
        const resp = await fetch(`/api/leadtime?inicio=${leadInicio}&fim=${leadFim}`, {
          cache: "no-store",
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Erro ao carregar lead time");
        setLeadTimePorSetor(data.leadTimePorSetor || []);
        setLeadTimeGeral(data.leadTimeGeral);
        setAmostrasGeral(data.amostrasGeral || 0);
      } catch (e: unknown) {
        setErroLead(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setCarregandoLead(false);
      }
    })();
  }, [leadInicio, leadFim]);

  useEffect(() => {
    (async () => {
      setCarregandoProducao(true);
      setErroProducao(null);
      try {
        const resp = await fetch(
          `/api/producao?inicio=${periodoInicio}&fim=${periodoFim}`,
          { cache: "no-store" }
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Erro ao carregar produção do período");
        setProducaoPeriodo(data.porSetor || []);
      } catch (e: unknown) {
        setErroProducao(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setCarregandoProducao(false);
      }
    })();
  }, [periodoInicio, periodoFim]);

  const diasUteisProducao = useMemo(
    () => diasUteisNoPeriodo(periodoInicio, periodoFim),
    [periodoInicio, periodoFim]
  );

  const capacidadeOficinasTotal = useMemo(
    () => Object.values(capacidadeOficinas).reduce((acc, v) => acc + v, 0),
    [capacidadeOficinas]
  );

  const producaoComCapacidade = useMemo(() => {
    return ordenarPorSetor(producaoPeriodo).map((entrada) => {
      const capacidadeDiaria =
        entrada.setor === "COSTURA EXTERNA"
          ? capacidadeOficinasTotal
          : capacidadeSetores[entrada.setor] ?? 0;
      const capacidadeEsperada =
        capacidadeDiaria > 0 ? capacidadeDiaria * diasUteisProducao : null;
      return { ...entrada, capacidadeEsperada };
    });
  }, [producaoPeriodo, capacidadeSetores, capacidadeOficinasTotal, diasUteisProducao]);

  const setoresEvolucaoDiariaChave = Array.from(setoresEvolucaoDiaria).sort().join(",");

  useEffect(() => {
    if (setoresEvolucaoDiaria.size === 0) {
      setProducaoDiariaSetor([]);
      setSetoresComDadosDiaria([]);
      return;
    }
    (async () => {
      setCarregandoProducaoDiaria(true);
      setErroProducaoDiaria(null);
      try {
        const resp = await fetch(
          `/api/producao-diaria?setores=${encodeURIComponent(
            Array.from(setoresEvolucaoDiaria).join(",")
          )}&inicio=${evolucaoInicio}&fim=${evolucaoFim}`,
          { cache: "no-store" }
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Erro ao carregar evolução dos setores");
        const pontos: { data: string; setor: string; pecas: number }[] = data.pontos || [];

        const datas = Array.from(new Set(pontos.map((p) => p.data))).sort();
        const setoresPresentes = ordenarPorSetor(
          Array.from(new Set(pontos.map((p) => p.setor))).map((setor) => ({ setor }))
        ).map((s) => s.setor);

        const linhas = datas.map((data) => {
          const linha: Record<string, string | number> = { data: formataDataCurta(data) };
          for (const setor of setoresPresentes) {
            const encontrado = pontos.find((p) => p.data === data && p.setor === setor);
            linha[setor] = encontrado?.pecas ?? 0;
          }
          return linha;
        });

        setProducaoDiariaSetor(linhas);
        setSetoresComDadosDiaria(setoresPresentes);
      } catch (e: unknown) {
        setErroProducaoDiaria(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setCarregandoProducaoDiaria(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setoresEvolucaoDiariaChave, evolucaoInicio, evolucaoFim]);

  const pecasPorSetor = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const op of ops) {
      mapa.set(op.setor, (mapa.get(op.setor) ?? 0) + (op.quantidade || 0));
    }
    return ORDEM_SETORES_GRAFICO.map((setor) => ({
      setor,
      pecas: mapa.get(setor) ?? 0,
    }));
  }, [ops]);

  const ocupacaoPorSetor = useMemo(() => {
    const cardsExterna = ops.filter((op) => op.setor === "COSTURA EXTERNA");
    const oficinasExterna = new Set(cardsExterna.map((op) => op.oficina).filter(Boolean) as string[]);
    const capacidadeExterna = Array.from(oficinasExterna).reduce(
      (acc, oficina) => acc + (capacidadeOficinas[oficina] ?? 0),
      0
    );
    const totalExterna = cardsExterna.reduce((acc, op) => acc + (op.quantidade || 0), 0);

    return ORDEM_SETORES_GRAFICO.map((setor) => {
      if (setor === "COSTURA EXTERNA") {
        return {
          setor,
          ocupacao: capacidadeExterna > 0 ? (totalExterna / capacidadeExterna) * 100 : null,
        };
      }
      const capacidade = capacidadeSetores[setor] ?? 0;
      const total = ops
        .filter((op) => op.setor === setor)
        .reduce((acc, op) => acc + (op.quantidade || 0), 0);
      return { setor, ocupacao: capacidade > 0 ? (total / capacidade) * 100 : null };
    });
  }, [ops, capacidadeSetores, capacidadeOficinas]);

  const distribuicaoDias = useMemo(() => {
    const buckets = { "0-2 dias": 0, "3-6 dias": 0, "7+ dias": 0, "sem data": 0 };
    for (const op of ops) {
      const dias = diasNoSetor(op.data_envio_fase);
      if (dias === null) buckets["sem data"]++;
      else if (dias <= 2) buckets["0-2 dias"]++;
      else if (dias <= 6) buckets["3-6 dias"]++;
      else buckets["7+ dias"]++;
    }
    return Object.entries(buckets)
      .filter(([, v]) => v > 0)
      .map(([faixa, quantidade]) => ({ faixa, quantidade }));
  }, [ops]);

  const rankingOficinas = useMemo(() => {
    const porOficina = new Map<string, number>();
    for (const op of ops) {
      if (op.setor !== "COSTURA EXTERNA" || !op.oficina) continue;
      porOficina.set(op.oficina, (porOficina.get(op.oficina) ?? 0) + (op.quantidade || 0));
    }
    return Array.from(porOficina.entries())
      .map(([oficina, pecas]) => {
        const capacidade = capacidadeOficinas[oficina] ?? 0;
        return {
          oficina: abreviaOficina(oficina),
          ocupacao: capacidade > 0 ? (pecas / capacidade) * 100 : null,
          pecas,
        };
      })
      .filter((o) => o.ocupacao !== null)
      .sort((a, b) => (b.ocupacao ?? 0) - (a.ocupacao ?? 0))
      .slice(0, 10);
  }, [ops, capacidadeOficinas]);

  const evolucaoTotal = useMemo(() => {
    const porData = new Map<string, number>();
    for (const linha of historico) {
      if (linha.data < evolTotalInicio || linha.data > evolTotalFim) continue;
      porData.set(linha.data, (porData.get(linha.data) ?? 0) + linha.total_pecas);
    }
    return Array.from(porData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, pecas]) => ({ data: formataDataCurta(data), pecas }));
  }, [historico, evolTotalInicio, evolTotalFim]);

  const { evolucaoPorSetor, setoresNaEvolucao } = useMemo(() => {
    const historicoPeriodo = historico.filter(
      (l) => l.data >= evolSetorInicio && l.data <= evolSetorFim
    );
    const datas = Array.from(new Set(historicoPeriodo.map((l) => l.data))).sort();
    const setoresPresentes = Array.from(new Set(historicoPeriodo.map((l) => l.setor))).filter(
      (s) => (SETORES_ORDEM as readonly string[]).includes(s) && !éSetorRetrabalho(s)
    );
    const ordenados = SETORES_ORDEM.filter((s) => setoresPresentes.includes(s));
    const linhas = datas.map((data) => {
      const linha: Record<string, string | number> = { data: formataDataCurta(data) };
      for (const setor of ordenados) {
        const encontrado = historicoPeriodo.find((l) => l.data === data && l.setor === setor);
        linha[setor] = encontrado?.total_pecas ?? 0;
      }
      return linha;
    });
    return { evolucaoPorSetor: linhas, setoresNaEvolucao: ordenados };
  }, [historico, evolSetorInicio, evolSetorFim]);

  const setoresParaExibirEvolucao = useMemo(
    () => setoresNaEvolucao.filter((s) => (setoresSelecionados ?? new Set(setoresNaEvolucao)).has(s)),
    [setoresNaEvolucao, setoresSelecionados]
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={estilos.header}>
        <div style={estilos.headerTopo}>
          <div>
            <h1 style={estilos.titulo}>Dashboard</h1>
            <p style={estilos.subtitulo}>Visão geral e evolução da produção</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/" style={estilos.botao}>
              ← Kanban
            </a>
            <a href="/capacidade" style={estilos.botao}>
              Capacidade
            </a>
            <a href="/upload" style={estilos.botao}>
              Enviar planilha
            </a>
          </div>
        </div>
      </header>

      <main style={estilos.main}>
        {erro && <div style={estilos.erroBox}>Erro: {erro}</div>}

        {carregando ? (
          <p style={{ color: "#6b7280" }}>Carregando...</p>
        ) : ops.length === 0 ? (
          <div style={estilos.estadoVazio}>
            Nenhuma OP encontrada. <a href="/upload">Envie uma planilha</a> pra ver os gráficos.
          </div>
        ) : (
          <div style={estilos.grade}>
            <section style={estilos.card}>
              <TituloGrafico
                titulo="Peças por setor (agora)"
                dica="Onde está concentrado o volume de peças parado neste momento."
              />
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={pecasPorSetor} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="setor"
                    fontSize={10.5}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={70}
                  />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString("pt-BR")} />
                  <Bar dataKey="pecas" name="Peças" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section style={estilos.card}>
              <TituloGrafico
                titulo="% de ocupação por setor (agora)"
                dica="Quão perto (ou acima) da capacidade diária configurada cada setor está agora."
              />
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={ocupacaoPorSetor} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="setor"
                    fontSize={10.5}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={70}
                  />
                  <YAxis fontSize={11} unit="%" />
                  <Tooltip
                    formatter={(v) => (v === null ? "sem capacidade configurada" : `${Number(v).toFixed(0)}%`)}
                  />
                  <Bar dataKey="ocupacao" name="Ocupação" radius={[4, 4, 0, 0]}>
                    {ocupacaoPorSetor.map((entrada, idx) => (
                      <Cell key={idx} fill={corOcupacao(entrada.ocupacao)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section style={estilos.card}>
              <TituloGrafico
                titulo="Distribuição de dias no setor"
                dica="Quantas OPs estão paradas há pouco tempo, tempo médio ou muito tempo — ajuda a ver gargalos."
              />
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={distribuicaoDias}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="faixa" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="quantidade" name="OPs" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section style={estilos.card}>
              <TituloGrafico
                titulo="Oficinas externas mais ocupadas"
                dica="Quais facções terceirizadas estão mais sobrecarregadas em relação à capacidade delas."
              />
              {rankingOficinas.length === 0 ? (
                <p style={estilos.semDados}>
                  Configure a capacidade das oficinas em /capacidade pra ver este gráfico.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={rankingOficinas} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={11} unit="%" />
                    <YAxis type="category" dataKey="oficina" width={130} fontSize={10} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(0)}%`} />
                    <Bar dataKey="ocupacao" name="Ocupação" radius={[0, 4, 4, 0]}>
                      {rankingOficinas.map((entrada, idx) => (
                        <Cell key={idx} fill={corOcupacao(entrada.ocupacao)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section style={{ ...estilos.card, ...estilos.cardLargo }}>
              <div style={estilos.cardTituloComFiltro}>
                <TituloGrafico
                  titulo="Evolução do total de peças em produção"
                  dica="Se o volume total parado na produção está crescendo ou diminuindo ao longo do tempo."
                />
                <FiltroPeriodo
                  preset={presetEvolTotal}
                  inicio={evolTotalInicio}
                  fim={evolTotalFim}
                  onPreset={mudarPresetEvolTotal}
                  onInicio={setEvolTotalInicio}
                  onFim={setEvolTotalFim}
                />
              </div>
              {evolucaoTotal.length < 2 ? (
                <p style={estilos.semDados}>
                  Ainda não há histórico suficiente — a cada planilha enviada, um ponto novo é
                  registrado aqui.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={evolucaoTotal}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString("pt-BR")} />
                    <Line type="monotone" dataKey="pecas" name="Peças" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </section>

            <section style={{ ...estilos.card, ...estilos.cardLargo }}>
              <div style={estilos.cardTituloComFiltro}>
                <TituloGrafico
                  titulo="Evolução de peças por setor"
                  dica="Como o volume parado em cada setor mudou dia a dia — mostra se um setor específico está acumulando fila."
                />
                <div style={estilos.filtroPeriodo}>
                  <button
                    onClick={() => setMostrarSeletorSetores((v) => !v)}
                    style={estilos.botaoPreset}
                  >
                    Setores ({setoresParaExibirEvolucao.length}/{setoresNaEvolucao.length})
                  </button>
                  <FiltroPeriodo
                    preset={presetEvolSetor}
                    inicio={evolSetorInicio}
                    fim={evolSetorFim}
                    onPreset={mudarPresetEvolSetor}
                    onInicio={setEvolSetorInicio}
                    onFim={setEvolSetorFim}
                  />
                </div>
              </div>
              {mostrarSeletorSetores && (
                <div style={estilos.seletorSetoresPainel}>
                  {setoresNaEvolucao.map((setor) => (
                    <label key={setor} style={estilos.seletorSetorItem}>
                      <input
                        type="checkbox"
                        checked={setoresParaExibirEvolucao.includes(setor)}
                        onChange={() => toggleSetorSelecionado(setor, setoresNaEvolucao)}
                      />
                      {setor}
                    </label>
                  ))}
                </div>
              )}
              {evolucaoPorSetor.length < 2 ? (
                <p style={estilos.semDados}>
                  Ainda não há histórico suficiente nesse período — a cada planilha enviada, um
                  ponto novo é registrado aqui.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={evolucaoPorSetor}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString("pt-BR")} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {setoresParaExibirEvolucao.map((setor) => (
                      <Line
                        key={setor}
                        type="monotone"
                        dataKey={setor}
                        stroke={corDoSetor(setor)}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </section>

            <section style={{ ...estilos.card, ...estilos.cardLargo }}>
              <div style={estilos.cardTituloComFiltro}>
                <TituloGrafico
                  titulo="Lead time (considera a data de saída do setor)"
                  dica="Quanto tempo, em média, uma OP fica em cada setor (e do início ao fim do processo) — mostra onde o fluxo está mais lento."
                />
                <FiltroPeriodo
                  preset={presetLead}
                  inicio={leadInicio}
                  fim={leadFim}
                  onPreset={mudarPresetLead}
                  onInicio={setLeadInicio}
                  onFim={setLeadFim}
                />
              </div>

              {erroLead ? (
                <p style={estilos.semDados}>Erro: {erroLead}</p>
              ) : carregandoLead ? (
                <p style={estilos.semDados}>Carregando...</p>
              ) : (
                <>
                  <h3 style={estilos.subTitulo}>Geral (fim a fim)</h3>
                  {leadTimeGeral === null ? (
                    <p style={estilos.semDados}>
                      Nenhuma OP concluiu todo o trajeto nesse período (isso vai se acumulando
                      conforme as OPs vão terminando).
                    </p>
                  ) : (
                    <div style={estilos.kpi}>
                      <span style={estilos.kpiValor}>{leadTimeGeral.toFixed(1)}</span>
                      <span style={estilos.kpiLabel}>
                        dias úteis em média, da primeira entrada registrada até a conclusão
                        <br />({amostrasGeral} OP{amostrasGeral === 1 ? "" : "s"} concluída
                        {amostrasGeral === 1 ? "" : "s"} nesse período)
                      </span>
                    </div>
                  )}

                  <h3 style={estilos.subTitulo}>Médio por setor (dias úteis)</h3>
                  {leadTimePorSetor.length === 0 ? (
                    <p style={estilos.semDados}>Nenhuma transição registrada nesse período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={ordenarPorSetor(leadTimePorSetor)} margin={{ bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="setor"
                          fontSize={10.5}
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                          height={70}
                        />
                        <YAxis fontSize={11} />
                        <Tooltip
                          formatter={(v, _n, item) => [
                            `${Number(v).toFixed(1)} dias (${item.payload.amostras} amostras)`,
                            "Lead time",
                          ]}
                        />
                        <Bar dataKey="mediaDias" name="Lead time" radius={[4, 4, 0, 0]}>
                          {ordenarPorSetor(leadTimePorSetor).map((entrada, idx) => (
                            <Cell key={idx} fill={corDoSetor(entrada.setor)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </section>

            <section style={{ ...estilos.card, ...estilos.cardLargo }}>
              <div style={estilos.cardTituloComFiltro}>
                <TituloGrafico
                  titulo="Produção por setor no período"
                  dica={`Quantas peças cada setor efetivamente concluiu ou avançou no período, comparado com a capacidade esperada (capacidade diária × ${diasUteisProducao} ${diasUteisProducao === 1 ? "dia útil" : "dias úteis"} no período) — a linha tracejada marca esse teto.`}
                />
                <FiltroPeriodo
                  preset={presetProducao}
                  inicio={periodoInicio}
                  fim={periodoFim}
                  onPreset={mudarPresetProducao}
                  onInicio={setPeriodoInicio}
                  onFim={setPeriodoFim}
                />
              </div>
              {erroProducao ? (
                <p style={estilos.semDados}>Erro: {erroProducao}</p>
              ) : carregandoProducao ? (
                <p style={estilos.semDados}>Carregando...</p>
              ) : producaoPeriodo.length === 0 ? (
                <p style={estilos.semDados}>
                  Nenhuma peça saiu de um setor nesse período (considera "produzido" toda peça que
                  avançou pra outro setor ou concluiu o processo).
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={producaoComCapacidade} margin={{ bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="setor"
                      fontSize={10.5}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={70}
                    />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(v, _n, item) => {
                        if (item.dataKey === "capacidadeEsperada") {
                          return [
                            v === null
                              ? "sem capacidade configurada"
                              : `${Number(v).toLocaleString("pt-BR")} pç`,
                            "Capacidade esperada",
                          ];
                        }
                        return [
                          `${Number(v).toLocaleString("pt-BR")} pç (${item.payload.ops} OPs)`,
                          "Produção",
                        ];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="pecas" name="Produção" radius={[4, 4, 0, 0]}>
                      {producaoComCapacidade.map((entrada, idx) => (
                        <Cell key={idx} fill={corDoSetor(entrada.setor)} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="capacidadeEsperada"
                      name="Capacidade esperada"
                      stroke="#111827"
                      strokeDasharray="5 4"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </section>

            <section style={{ ...estilos.card, ...estilos.cardLargo }}>
              <div style={estilos.cardTituloComFiltro}>
                <TituloGrafico
                  titulo="Evolução diária de produção por setor"
                  dica="Como a produção diária de cada setor selecionado variou dia a dia dentro do período."
                />
                <div style={estilos.filtroPeriodo}>
                  <button
                    onClick={() => setMostrarSeletorEvolucaoDiaria((v) => !v)}
                    style={estilos.botaoPreset}
                  >
                    Setores ({setoresEvolucaoDiaria.size}/{ORDEM_SETORES_GRAFICO.length})
                  </button>
                  <FiltroPeriodo
                    preset={presetEvolucao}
                    inicio={evolucaoInicio}
                    fim={evolucaoFim}
                    onPreset={mudarPresetEvolucao}
                    onInicio={setEvolucaoInicio}
                    onFim={setEvolucaoFim}
                  />
                </div>
              </div>
              {mostrarSeletorEvolucaoDiaria && (
                <div style={estilos.seletorSetoresPainel}>
                  {ORDEM_SETORES_GRAFICO.map((setor) => (
                    <label key={setor} style={estilos.seletorSetorItem}>
                      <input
                        type="checkbox"
                        checked={setoresEvolucaoDiaria.has(setor)}
                        onChange={() => toggleSetorEvolucaoDiaria(setor)}
                      />
                      {setor}
                    </label>
                  ))}
                </div>
              )}
              {erroProducaoDiaria ? (
                <p style={estilos.semDados}>Erro: {erroProducaoDiaria}</p>
              ) : carregandoProducaoDiaria ? (
                <p style={estilos.semDados}>Carregando...</p>
              ) : setoresEvolucaoDiaria.size === 0 ? (
                <p style={estilos.semDados}>Selecione ao menos um setor.</p>
              ) : producaoDiariaSetor.length === 0 ? (
                <p style={estilos.semDados}>Nenhuma peça saiu desses setores nesse período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={producaoDiariaSetor}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v) => `${Number(v).toLocaleString("pt-BR")} pç`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {setoresComDadosDiaria.map((setor) => (
                      <Line
                        key={setor}
                        type="monotone"
                        dataKey={setor}
                        name={setor}
                        stroke={corDoSetor(setor)}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  header: {
    background: "#14142b",
    color: "#fff",
    padding: "20px 24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
  main: { maxWidth: 1200, margin: "0 auto", padding: "24px 24px 60px" },
  erroBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13.5,
  },
  estadoVazio: {
    textAlign: "center",
    padding: 60,
    color: "#6b7280",
    fontSize: 14,
  },
  grade: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 18,
  },
  cardLargo: {
    gridColumn: "1 / -1",
  },
  cardTitulo: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
  },
  dicaTexto: {
    fontSize: 11.5,
    color: "#9ca3af",
    margin: "3px 0 12px",
    lineHeight: 1.4,
  },
  seletorSetoresPainel: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  seletorSetorItem: {
    fontSize: 11.5,
    display: "flex",
    alignItems: "center",
    gap: 5,
    color: "#374151",
  },
  cardTituloComFiltro: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  filtroPeriodo: {
    display: "flex",
    gap: 12,
  },
  filtroPeriodoLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
  },
  filtroPeriodoInput: {
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "5px 8px",
    fontSize: 12.5,
  },
  botaoPreset: {
    alignSelf: "flex-end",
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
    cursor: "pointer",
  },
  subTitulo: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "#4b5563",
    margin: "16px 0 8px",
  },
  semDados: {
    color: "#9ca3af",
    fontSize: 12.5,
    textAlign: "center",
    padding: "40px 10px",
  },
  kpi: {
    display: "flex",
    alignItems: "baseline",
    gap: 14,
    padding: "20px 10px",
  },
  kpiValor: {
    fontSize: 42,
    fontWeight: 800,
    color: "#0ea5e9",
    lineHeight: 1,
  },
  kpiLabel: {
    fontSize: 12.5,
    color: "#6b7280",
    lineHeight: 1.4,
  },
};
