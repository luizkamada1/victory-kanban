"use client";

import { useState } from "react";

export default function UploadPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Atualizar dados do kanban</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
        Envie a planilha exportada do ERP. Os dados anteriores serão substituídos pelos
        novos.
      </p>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        style={{ marginBottom: 12, display: "block" }}
      />

      <input
        type="password"
        placeholder="Senha de upload (se configurada)"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 12,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          boxSizing: "border-box",
        }}
      />

      <button
        onClick={enviar}
        disabled={!arquivo || enviando}
        style={{
          background: "#1a1a2e",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "10px 18px",
          fontSize: 14,
          cursor: arquivo && !enviando ? "pointer" : "not-allowed",
          opacity: arquivo && !enviando ? 1 : 0.5,
        }}
      >
        {enviando ? "Enviando..." : "Enviar e atualizar kanban"}
      </button>

      {resultado && (
        <div style={{ marginTop: 16, color: "#166534", background: "#dcfce7", padding: 10, borderRadius: 8 }}>
          {resultado}{" "}
          <a href="/">Ver kanban</a>
        </div>
      )}
      {erro && (
        <div style={{ marginTop: 16, color: "#991b1b", background: "#fee2e2", padding: 10, borderRadius: 8 }}>
          Erro: {erro}
        </div>
      )}

      <p style={{ marginTop: 24 }}>
        <a href="/">← Voltar para o kanban</a>
      </p>
    </div>
  );
}
