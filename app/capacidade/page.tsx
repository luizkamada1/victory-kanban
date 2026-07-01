"use client";

import { useEffect, useState } from "react";
import { SETORES_COM_CAPACIDADE } from "@/lib/setores";

export default function CapacidadePage() {
  const [setores, setSetores] = useState<Record<string, number>>({});
  const [oficinas, setOficinas] = useState<Record<string, number>>({});
  const [novaOficina, setNovaOficina] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/capacidade", { cache: "no-store" });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Erro ao carregar capacidades");
        setSetores(data.setores);
        setOficinas(data.oficinas);
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    try {
      const resp = await fetch("/api/capacidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setores, oficinas }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro ao salvar");
      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSalvando(false);
    }
  }

  function adicionarOficina() {
    const nome = novaOficina.trim();
    if (!nome || nome in oficinas) return;
    setOficinas({ ...oficinas, [nome]: 0 });
    setNovaOficina("");
  }

  function removerOficina(nome: string) {
    const copia = { ...oficinas };
    delete copia[nome];
    setOficinas(copia);
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={estilos.header}>
        <div style={estilos.headerTopo}>
          <div>
            <h1 style={estilos.titulo}>Capacidade Produtiva</h1>
            <p style={estilos.subtitulo}>Configure a capacidade diária de cada setor</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/" style={estilos.botao}>
              ← Kanban
            </a>
            <a href="/upload" style={estilos.botao}>
              Enviar planilha
            </a>
          </div>
        </div>
      </header>

      <main style={estilos.main}>
        {erro && <div style={estilos.erroBox}>Erro: {erro}</div>}
        {sucesso && <div style={estilos.sucessoBox}>Capacidades salvas com sucesso.</div>}

        {carregando ? (
          <p style={{ color: "#6b7280" }}>Carregando...</p>
        ) : (
          <>
            <section style={estilos.secao}>
              <h2 style={estilos.secaoTitulo}>Capacidade por setor (peças/dia)</h2>
              <div style={estilos.grade}>
                {SETORES_COM_CAPACIDADE.map((setor) => (
                  <label key={setor} style={estilos.campo}>
                    <span style={estilos.campoLabel}>{setor}</span>
                    <input
                      type="number"
                      min={0}
                      value={setores[setor] ?? 0}
                      onChange={(e) =>
                        setSetores({ ...setores, [setor]: Number(e.target.value) })
                      }
                      style={estilos.campoInput}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section style={estilos.secao}>
              <h2 style={estilos.secaoTitulo}>Capacidade por oficina (Costura Externa)</h2>
              <p style={estilos.secaoDescricao}>
                As oficinas detectadas nas planilhas enviadas aparecem automaticamente abaixo.
                Você também pode adicionar uma oficina manualmente.
              </p>
              <div style={estilos.grade}>
                {Object.keys(oficinas)
                  .sort()
                  .map((oficina) => (
                    <div key={oficina} style={estilos.campoOficina}>
                      <span style={estilos.campoLabel}>{oficina}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="number"
                          min={0}
                          value={oficinas[oficina] ?? 0}
                          onChange={(e) =>
                            setOficinas({ ...oficinas, [oficina]: Number(e.target.value) })
                          }
                          style={estilos.campoInput}
                        />
                        <button
                          onClick={() => removerOficina(oficina)}
                          style={estilos.botaoRemover}
                          aria-label={`Remover ${oficina}`}
                          title="Remover"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                {Object.keys(oficinas).length === 0 && (
                  <p style={{ color: "#9ca3af", fontSize: 13 }}>
                    Nenhuma oficina detectada ainda.
                  </p>
                )}
              </div>

              <div style={estilos.novaOficinaWrapper}>
                <input
                  type="text"
                  value={novaOficina}
                  onChange={(e) => setNovaOficina(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionarOficina()}
                  placeholder="Nome da nova oficina"
                  style={estilos.novaOficinaInput}
                />
                <button onClick={adicionarOficina} style={estilos.botaoSecundario}>
                  + Adicionar oficina
                </button>
              </div>
            </section>

            <button onClick={salvar} disabled={salvando} style={estilos.botaoSalvar}>
              {salvando ? "Salvando..." : "Salvar capacidades"}
            </button>
          </>
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
  main: { maxWidth: 760, margin: "0 auto", padding: "28px 24px 60px" },
  erroBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13.5,
  },
  sucessoBox: {
    background: "#dcfce7",
    color: "#166534",
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13.5,
  },
  secao: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  secaoTitulo: { fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: "#111827" },
  secaoDescricao: { fontSize: 12.5, color: "#6b7280", margin: "0 0 14px" },
  grade: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12,
  },
  campo: { display: "flex", flexDirection: "column", gap: 4 },
  campoOficina: { display: "flex", flexDirection: "column", gap: 4 },
  campoLabel: { fontSize: 12, fontWeight: 600, color: "#374151" },
  campoInput: {
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "7px 10px",
    fontSize: 13.5,
    width: "100%",
    boxSizing: "border-box",
  },
  botaoRemover: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "none",
    borderRadius: 6,
    width: 28,
    height: 28,
    fontSize: 16,
    cursor: "pointer",
    flexShrink: 0,
  },
  novaOficinaWrapper: { display: "flex", gap: 8, marginTop: 16 },
  novaOficinaInput: {
    flex: 1,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13.5,
  },
  botaoSecundario: {
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    color: "#1a1a2e",
    whiteSpace: "nowrap",
  },
  botaoSalvar: {
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },
};
