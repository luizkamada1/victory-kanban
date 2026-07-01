export const metadata = {
  title: "Victory Pijamas — Kanban de Produção",
  description: "Visão macro das OPs em andamento por setor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#f4f5f7",
          color: "#1a1a2e",
        }}
      >
        {children}
      </body>
    </html>
  );
}
