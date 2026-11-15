# 🏖️ Na Areia

Bancas e ambulantes da praia (lanches, doces, bebidas, petiscos) conectados aos clientes.

- **Cliente** (`/`): quem está aberto perto, busca por produto ("quem tem açaí?"), categorias, lista ou mapa,
  vitrine com fotos e preços, rota a pé (Apple Maps no iPhone, Google Maps no Android), carrinho e pedido.
- **Vendedor** (`/vender/`): entra com código por e-mail, cadastra banca ou carrinho de ambulante com foto,
  produtos com foto tirada na hora e sugestões prontas, marca "tem / acabou", abre e fecha. Ambulante tem a
  posição atualizada sozinha enquanto o app está aberto.
- **Pagamento:** Pix direto para o vendedor (ou dinheiro). O app não toca no dinheiro.

Funciona no navegador do Android e do iPhone e pode ser instalado na tela inicial. Sem app store.

## Fases

1. **Vitrine** — pronto. O pedido sai pelo WhatsApp do vendedor, já montado.
2. **Pedido no app** — o vendedor recebe na hora, aceita, sai para entregar; o cliente acompanha. O banco já está pronto para isso.
3. **Ao vivo** — aviso de pedido com o app fechado, avaliações.

## Ligar o Supabase

1. Criar projeto em supabase.com (região São Paulo).
2. Authentication → Sign In / Providers → **Email** ligado; **Allow anonymous sign-ins** ligado (clientes, fase 2).
3. Authentication → Emails → Templates → **Magic Link**: colocar `{{ .Token }}` no texto (o app usa o código de 6 números).
4. SQL Editor → colar `supabase/schema.sql` → Run.
5. Colocar a Project URL e a chave **anon/publishable** em `comum/config.js`.
6. Para muitos vendedores: Authentication → Emails → **SMTP** próprio (o envio padrão do Supabase é limitado a poucos e-mails por hora).

## Segurança

As regras ficam no banco (`supabase/schema.sql`): o público só vê vendedores abertos nas últimas 12 h;
cada vendedor só mexe na própria banca, produtos e fotos; o preço do pedido é recalculado pelo banco;
o andamento do pedido só segue os passos permitidos.
