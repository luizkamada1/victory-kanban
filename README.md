# Victory Pijamas — Kanban de Produção

App web que lê a planilha exportada do ERP e mostra as OPs em andamento em formato
kanban, organizadas por setor.

## Passo a passo para publicar (gratuito)

### 1. Criar o banco de dados (Supabase)

1. Acesse https://supabase.com e crie uma conta gratuita.
2. Clique em **New project**. Escolha um nome (ex: `victory-kanban`) e uma senha
   de banco (guarde essa senha, mas não é o que vamos usar no app).
3. Depois que o projeto for criado, vá em **SQL Editor** (menu lateral) → **New query**.
4. Copie e cole o conteúdo do arquivo `supabase_setup.sql` (incluso neste projeto) e
   clique em **Run**. Isso cria a tabela `producao_ops`.
5. Vá em **Project Settings** (ícone de engrenagem) → **API**.
   - Copie o valor de **Project URL** → isso é o `SUPABASE_URL`.
   - Copie o valor de **service_role** (em "Project API keys") → isso é o
     `SUPABASE_SERVICE_ROLE_KEY`. **Nunca exponha essa chave publicamente** — ela só
     vai para variáveis de ambiente do servidor, não para o navegador.

### 2. Publicar o app (Vercel)

1. Acesse https://vercel.com e crie uma conta gratuita (pode usar login com GitHub).
2. A forma mais simples: suba esta pasta para um repositório no GitHub
   (crie um repo novo, ex: `victory-kanban`, e faça push de todos os arquivos).
3. No Vercel, clique em **Add New → Project**, selecione o repositório
   `victory-kanban`.
4. Antes de clicar em "Deploy", abra a seção **Environment Variables** e adicione:
   - `SUPABASE_URL` → o Project URL copiado no passo anterior
   - `SUPABASE_SERVICE_ROLE_KEY` → a service_role key copiada no passo anterior
   - `UPLOAD_PASSCODE` (opcional) → uma senha simples para proteger a página de
     upload (ex: `victory2026`). Se deixar em branco, qualquer pessoa com o link
     `/upload` pode enviar planilhas.
5. Clique em **Deploy**. Em ~1 minuto o Vercel te dará uma URL pública, tipo
   `https://victory-kanban.vercel.app`.

### 3. Usar no dia a dia

- **Kanban (todos acessam)**: `https://victory-kanban.vercel.app`
- **Upload (você atualiza)**: `https://victory-kanban.vercel.app/upload`
  - Baixe a planilha do ERP normalmente, entre nessa página, selecione o arquivo,
    digite a senha de upload (se configurou) e clique em enviar.
  - O kanban atualiza sozinho a cada 5 minutos para quem estiver com a página
    aberta, ou instantaneamente se a pessoa clicar em "Atualizar agora".

## Rodar localmente (opcional, para testar antes de publicar)

```bash
npm install
cp .env.example .env.local   # preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

Acesse http://localhost:3000

## Observações

- Cada upload **substitui** os dados anteriores — a planilha é sempre tratada como
  uma foto atual da produção, não um histórico acumulado.
- Linhas repetidas da mesma OP no mesmo setor são somadas automaticamente em um
  único card.
- Os "dias no setor" são calculados a partir da coluna `Data envio fase`.
- A coluna `Oficina` só aparece nos cards do setor COSTURA (pode ajustar em
  `lib/setores.ts`, constante `SETORES_COM_OFICINA`).
- A ordem e a lista de setores/colunas ficam em `lib/setores.ts` — para
  adicionar, remover ou reordenar setores, edite esse arquivo.
