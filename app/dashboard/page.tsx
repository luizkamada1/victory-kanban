"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
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
import { SETORES_ORDEM, SETORES_COM_CAPACIDADE } from "@/lib/setores";
import { diasNoSetor, corOcupacao, abreviaOficina } from "@/lib/kanban-utils";

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

  const [leadInicio, setLeadInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [leadFim, setLeadFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [carregandoLead, setCarregandoLead] = useState(false);
  const [erroLead, setErroLead] = useState<string | null>(null);

  function aplicarPresetLead(inicio: Date, fim: Date) {
    setLeadInicio(inicio.toISOString().slice(0, 10));
    setLeadFim(fim.toISOString().slice(0, 10));
  }
  function presetEsteMes() {
    const hoje = new Date();
    aplicarPresetLead(new Date(hoje.getFullYear(), hoje.getMonth(), 1), hoje);
  }
  function presetMesPassado() {
    const hoje = new Date();
    aplicarPresetLead(
      new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
      new Date(hoje.getFullYear(), hoje.getMonth(), 0)
    );
  }

  const [periodoInicio, setPeriodoInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [periodoFim, setPeriodoFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [producaoPeriodo, setProducaoPeriodo] = useState<
    { setor: string; pecas: number; ops: number }[]
  >([]);
  const [carregandoProducao, setCarregandoProducao] = useState(false);
  const [erroProducao, setErroProducao] = useState<string | null>(null);

  const [setorEvolucao, setSetorEvolucao] = useState<string>(SETORES_ORDEM[0]);
  const [evolucaoInicio, setEvolucaoInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [evolucaoFim, setEvolucaoFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [producaoDiariaSetor, setProducaoDiariaSetor] = useState<{ data: string; pecas: number }[]>(
    []
  );
  const [carregandoProducaoDiaria, setCarregandoProducaoDiaria] = useState(false);
  const [erroProducaoDiaria, setErroProducaoDiaria] = useState<string | null>(null);

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

  useEffect(() => {
    (async () => {
      setCarregandoProducaoDiaria(true);
      setErroProducaoDiaria(null);
      try {
        const resp = await fetch(
          `/api/producao-diaria?setor=${encodeURIComponent(setorEvolucao)}&inicio=${evolucaoInicio}&fim=${evolucaoFim}`,
          { cache: "no-store" }
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Erro ao carregar evolução do setor");
        setProducaoDiariaSetor(
          (data.pontos || []).map((p: { data: string; pecas: number }) => ({
            data: formataDataCurta(p.data),
            pecas: p.pecas,
          }))
        );
      } catch (e: unknown) {
        setErroProducaoDiaria(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setCarregandoProducaoDiaria(false);
      }
    })();
  }, [setorEvolucao, evolucaoInicio, evolucaoFim]);

  const pecasPorSetor = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const op of ops) {
      mapa.set(op.setor, (mapa.get(op.setor) ?? 0) + (op.quantidade || 0));
    }
    return SETORES_ORDEM.filter((s) => mapa.has(s)).map((setor) => ({
      setor,
      pecas: mapa.get(setor) ?? 0,
    }));
  }, [ops]);

  const ocupacaoPorSetor = useMemo(() => {
    const resultado: { setor: string; ocupacao: number }[] = [];
    for (const setor of SETORES_COM_CAPACIDADE) {
      const capacidade = capacidadeSetores[setor] ?? 0;
      if (capacidade <= 0) continue;
      const total = ops
        .filter((op) => op.setor === setor)
        .reduce((acc, op) => acc + (op.quantidade || 0), 0);
      resultado.push({ setor, ocupacao: (total / capacidade) * 100 });
    }
    const cardsExterna = ops.filter((op) => op.setor === "COSTURA EXTERNA");
    const oficinasExterna = new Set(cardsExterna.map((op) => op.oficina).filter(Boolean) as string[]);
    const capacidadeExterna = Array.from(oficinasExterna).reduce(
      (acc, oficina) => acc + (capacidadeOficinas[oficina] ?? 0),
      0
    );
    if (capacidadeExterna > 0) {
      const totalExterna = cardsExterna.reduce((acc, op) => acc + (op.quantidade || 0), 0);
      resultado.push({ setor: "COSTURA EXTERNA", ocupacao: (totalExterna / capacidadeExterna) * 100 });
    }
    return resultado;
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
      porData.set(linha.data, (porData.get(linha.data) ?? 0) + linha.total_pecas);
    }
    return Array.from(porData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, pecas]) => ({ data: formataDataCurta(data), pecas }));
  }, [historico]);

  const { evolucaoPorSetor, setoresNaEvolucao } = useMemo(() => {
    const datas = Array.from(new Set(historico.map((l) => l.data))).sort();
    const setoresPresentes = Array.from(new Set(historico.map((l) => l.setor))).filter((s) =>
      (SETORES_ORDEM as readonly string[]).includes(s)
    );
    const ordenados = SETORES_ORDEM.filter((s) => setoresPresentes.includes(s));
    const linhas = datas.map((data) => {
      const linha: Record<string, string | number> = { data: formataDataCurta(data) };
      for (const setor of ordenados) {
        const encontrado = historico.find((l) => l.data === data && l.setor === setor);
        linha[setor] = encontrado?.total_pecas ?? 0;
      }
      return linha;
    });
    return { evolucaoPorSetor: linhas, setoresNaEvolucao: ordenados };
  }, [historico]);

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
              <h2 style={estilos.cardTitulo}>Peças por setor (agora)</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pecasPorSetor} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="setor" width={110} fontSize={10.5} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString("pt-BR")} />
                  <Bar dataKey="pecas" name="Peças" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section style={estilos.card}>
              <h2 style={estilos.cardTitulo}>% de ocupação por setor (agora)</h2>
              {ocupacaoPorSetor.length === 0 ? (
                <p style={estilos.semDados}>Configure a capacidade em /capacidade pra ver este gráfico.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={ocupacaoPorSetor} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={11} unit="%" />
                    <YAxis type="category" dataKey="setor" width={110} fontSize={10.5} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(0)}%`} />
                    <Bar dataKey="ocupacao" name="Ocupação" radius={[0, 4, 4, 0]}>
                      {ocupacaoPorSetor.map((entrada, idx) => (
                        <Cell key={idx} fill={corOcupacao(entrada.ocupacao)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section style={estilos.card}>
              <h2 style={estilos.cardTitulo}>Distribuição de dias no setor</h2>
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
              <h2 style={estilos.cardTitulo}>Oficinas externas mais ocupadas</h2>
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
              <h2 style={estilos.cardTitulo}>Evolução do total de peças em produção</h2>
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
              <h2 style={estilos.cardTitulo}>Evolução de peças por setor</h2>
              {evolucaoPorSetor.length < 2 ? (
                <p style={estilos.semDados}>
                  Ainda não há histórico suficiente — a cada planilha enviada, um ponto novo é
                  registrado aqui.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={evolucaoPorSetor}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString("pt-BR")} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {setoresNaEvolucao.map((setor, idx) => (
                      <Line
                        key={setor}
                        type="monotone"
                        dataKey={setor}
                        stroke={CORES_SERIE[idx % CORES_SERIE.length]}
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
                <h2 style={estilos.cardTitulo}>Lead time (considera a data de saída do setor)</h2>
                <div style={estilos.filtroPeriodo}>
                  <button onClick={presetEsteMes} style={estilos.botaoPreset}>
                    Este mês
                  </button>
                  <button onClick={presetMesPassado} style={estilos.botaoPreset}>
                    Mês passado
                  </button>
                  <label style={estilos.filtroPeriodoLabel}>
                    De
                    <input
                      type="date"
                      value={leadInicio}
                      max={leadFim}
                      onChange={(e) => setLeadInicio(e.target.value)}
                      style={estilos.filtroPeriodoInput}
                    />
                  </label>
                  <label style={estilos.filtroPeriodoLabel}>
                    Até
                    <input
                      type="date"
                      value={leadFim}
                      min={leadInicio}
                      onChange={(e) => setLeadFim(e.target.value)}
                      style={estilos.filtroPeriodoInput}
                    />
                  </label>
                </div>
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
                    <ResponsiveContainer
                      width="100%"
                      height={Math.max(200, leadTimePorSetor.length * 34)}
                    >
                      <BarChart data={leadTimePorSetor} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" fontSize={11} />
                        <YAxis type="category" dataKey="setor" width={110} fontSize={10.5} />
                        <Tooltip
                          formatter={(v, _n, item) => [
                            `${Number(v).toFixed(1)} dias (${item.payload.amostras} amostras)`,
                            "Lead time",
                          ]}
                        />
                        <Bar dataKey="mediaDias" name="Lead time" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </section>

            <section style={{ ...estilos.card, ...estilos.cardLargo }}>
              <div style={estilos.cardTituloComFiltro}>
                <h2 style={estilos.cardTitulo}>Produção por setor no período</h2>
                <div style={estilos.filtroPeriodo}>
                  <label style={estilos.filtroPeriodoLabel}>
                    De
                    <input
                      type="date"
                      value={periodoInicio}
                      max={periodoFim}
                      onChange={(e) => setPeriodoInicio(e.target.value)}
                      style={estilos.filtroPeriodoInput}
                    />
                  </label>
                  <label style={estilos.filtroPeriodoLabel}>
                    Até
                    <input
                      type="date"
                      value={periodoFim}
                      min={periodoInicio}
                      onChange={(e) => setPeriodoFim(e.target.value)}
                      style={estilos.filtroPeriodoInput}
                    />
                  </label>
                </div>
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
                  <BarChart data={producaoPeriodo} margin={{ bottom: 40 }}>
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
                        `${Number(v).toLocaleString("pt-BR")} pç (${item.payload.ops} OPs)`,
                        "Produção",
                      ]}
                    />
                    <Bar dataKey="pecas" name="Produção" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section style={{ ...estilos.card, ...estilos.cardLargo }}>
              <div style={estilos.cardTituloComFiltro}>
                <h2 style={estilos.cardTitulo}>Evolução diária de produção por setor</h2>
                <div style={estilos.filtroPeriodo}>
                  <label style={estilos.filtroPeriodoLabel}>
                    Setor
                    <select
                      value={setorEvolucao}
                      onChange={(e) => setSetorEvolucao(e.target.value)}
                      style={estilos.filtroPeriodoInput}
                    >
                      {SETORES_ORDEM.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={estilos.filtroPeriodoLabel}>
                    De
                    <input
                      type="date"
                      value={evolucaoInicio}
                      max={evolucaoFim}
                      onChange={(e) => setEvolucaoInicio(e.target.value)}
                      style={estilos.filtroPeriodoInput}
                    />
                  </label>
                  <label style={estilos.filtroPeriodoLabel}>
                    Até
                    <input
                      type="date"
                      value={evolucaoFim}
                      min={evolucaoInicio}
                      onChange={(e) => setEvolucaoFim(e.target.value)}
                      style={estilos.filtroPeriodoInput}
                    />
                  </label>
                </div>
              </div>
              {erroProducaoDiaria ? (
                <p style={estilos.semDados}>Erro: {erroProducaoDiaria}</p>
              ) : carregandoProducaoDiaria ? (
                <p style={estilos.semDados}>Carregando...</p>
              ) : producaoDiariaSetor.length === 0 ? (
                <p style={estilos.semDados}>
                  Nenhuma peça saiu de {setorEvolucao} nesse período.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={producaoDiariaSetor}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v) => `${Number(v).toLocaleString("pt-BR")} pç`} />
                    <Line
                      type="monotone"
                      dataKey="pecas"
                      name="Produção"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
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
    margin: "0 0 12px",
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
