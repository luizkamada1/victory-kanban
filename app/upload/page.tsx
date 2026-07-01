"use client";

import { useState } from "react";

export default function UploadPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  async function enviar() {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    setResultado(null);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      form.append("passcode", senha);
      const resp = await fetch("/api/upload", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Falha no upload");
      setResultado(`Kanban atualizado: ${data.total_ops} OPs processadas.`);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setEnviando(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) {
      setArquivo(file);
      setResultado(null);
      setErro(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={estilos.header}>
        <div style={estilos.headerTopo}>
          <div>
            <h1 style={estilos.titulo}>Enviar planilha</h1>
            <p style={estilos.subtitulo}>Atualize os dados do kanban de produção</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/" style={estilos.botao}>
              ← Kanban
            </a>
            <a href="/capacidade" style={estilos.botao}>
              Capacidade
            </a>
          </div>
        </div>
      </header>

      <main style={estilos.main}>
        <div style={estilos.card}>
          <p style={estilos.descricao}>
            Envie a planilha exportada do ERP. Os dados anteriores serão{" "}
            <strong>substituídos</strong> pelos novos.
          </p>

          <label
            htmlFor="arquivo"
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              handleFiles(e.dataTransfer.files);
            }}
            style={{
              ...estilos.dropzone,
              ...(arrastando ? estilos.dropzoneAtivo : {}),
              ...(arquivo ? estilos.dropzoneComArquivo : {}),
            }}
          >
            <input
              id="arquivo"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: "none" }}
            />
            <span style={estilos.dropzoneIcone}>{arquivo ? "📄" : "📤"}</span>
            {arquivo ? (
              <>
                <span style={estilos.dropzoneTextoForte}>{arquivo.name}</span>
                <span style={estilos.dropzoneTexto}>
                  {(arquivo.size / 1024).toFixed(0)} KB · clique para trocar
                </span>
              </>
            ) : (
              <>
                <span style={estilos.dropzoneTextoForte}>
                  Arraste a planilha aqui ou clique para selecionar
                </span>
                <span style={estilos.dropzoneTexto}>Arquivos .xlsx ou .xls</span>
              </>
            )}
          </label>

          <input
            type="password"
            placeholder="Senha de upload (se configurada)"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={estilos.inputSenha}
          />

          <button
            onClick={enviar}
            disabled={!arquivo || enviando}
            style={{
              ...estilos.botaoEnviar,
              ...(arquivo && !enviando ? {} : estilos.botaoEnviarDesabilitado),
            }}
          >
            {enviando ? "Enviando..." : "Enviar e atualizar kanban"}
          </button>

          {resultado && (
            <div style={estilos.sucessoBox}>
              ✓ {resultado} <a href="/" style={estilos.link}>Ver kanban</a>
            </div>
          )}
          {erro && <div style={estilos.erroBox}>Erro: {erro}</div>}
        </div>
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
  main: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "40px 24px 60px",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 26,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  descricao: {
    color: "#4b5563",
    fontSize: 13.5,
    lineHeight: 1.5,
    marginTop: 0,
    marginBottom: 20,
  },
  dropzone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    border: "2px dashed #d1d5db",
    borderRadius: 12,
    padding: "28px 16px",
    textAlign: "center",
    cursor: "pointer",
    background: "#fafafa",
    transition: "border-color 0.15s, background 0.15s",
  },
  dropzoneAtivo: {
    borderColor: "#6366f1",
    background: "#eef2ff",
  },
  dropzoneComArquivo: {
    borderColor: "#16a34a",
    background: "#f0fdf4",
  },
  dropzoneIcone: { fontSize: 28 },
  dropzoneTextoForte: {
    fontSize: 13.5,
    fontWeight: 700,
    color: "#111827",
    marginTop: 4,
  },
  dropzoneTexto: {
    fontSize: 12,
    color: "#6b7280",
  },
  inputSenha: {
    width: "100%",
    boxSizing: "border-box",
    padding: 10,
    marginTop: 16,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 13.5,
  },
  botaoEnviar: {
    width: "100%",
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 16,
  },
  botaoEnviarDesabilitado: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  sucessoBox: {
    marginTop: 16,
    color: "#166534",
    background: "#dcfce7",
    padding: 12,
    borderRadius: 8,
    fontSize: 13.5,
  },
  erroBox: {
    marginTop: 16,
    color: "#991b1b",
    background: "#fee2e2",
    padding: 12,
    borderRadius: 8,
    fontSize: 13.5,
  },
  link: {
    color: "#166534",
    fontWeight: 700,
    textDecoration: "underline",
  },
};
