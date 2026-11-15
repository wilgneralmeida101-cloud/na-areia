-- =====================================================================
-- Na Areia — bancas e ambulantes de praia conectados aos clientes.
-- Cole TUDO no Supabase: SQL Editor → New query → Run.
-- Pode rodar de novo quando eu mandar uma versão nova (não apaga dados).
-- =====================================================================

-- ---------- quem é vendedor de verdade (entrou com e-mail, não anônimo) ----------
create or replace function public.eh_vendedor_real() returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

-- ---------- vendedores: bancas e ambulantes ----------
create table if not exists public.vendedores (
  id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nome          text not null check (char_length(nome) between 2 and 40),
  tipo          text not null default 'banca' check (tipo in ('banca', 'ambulante')),
  descricao     text check (char_length(descricao) <= 140),
  foto_url      text check (char_length(foto_url) <= 400),
  whatsapp      text check (whatsapp ~ '^[0-9]{12,13}$'),
  pix_chave     text check (char_length(pix_chave) <= 77),
  faz_entrega   boolean not null default false,
  aberto        boolean not null default false,
  lat           double precision check (lat between -90 and 90),
  lon           double precision check (lon between -180 and 180),
  atualizado_em timestamptz not null default now(),
  criado_em     timestamptz not null default now(),
  constraint aberto_precisa_de_lugar check (not aberto or (lat is not null and lon is not null))
);
create index if not exists vendedores_abertos_idx on public.vendedores (aberto, atualizado_em);

-- ---------- produtos da vitrine ----------
create table if not exists public.produtos (
  id             uuid primary key default gen_random_uuid(),
  vendedor       uuid not null default auth.uid() references public.vendedores (id) on delete cascade,
  nome           text not null check (char_length(nome) between 2 and 50),
  preco_centavos integer not null check (preco_centavos between 0 and 100000),
  categoria      text not null default 'outro' check (categoria in ('bebida', 'lanche', 'doce', 'petisco', 'outro')),
  foto_url       text check (char_length(foto_url) <= 400),
  disponivel     boolean not null default true,
  ordem          integer not null default 0,
  criado_em      timestamptz not null default now()
);
create index if not exists produtos_vendedor_idx on public.produtos (vendedor);

-- ---------- pedidos (fase 2) ----------
create table if not exists public.pedidos (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  vendedor       uuid not null references public.vendedores (id) on delete cascade,
  cliente        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cliente_nome   text not null check (char_length(cliente_nome) between 1 and 30),
  itens          jsonb not null,
  total_centavos integer not null default 0,
  entrega        boolean not null default true,
  lat            double precision check (lat between -90 and 90),
  lon            double precision check (lon between -180 and 180),
  referencia     text check (char_length(referencia) <= 120),
  pagamento      text not null default 'pix' check (pagamento in ('pix', 'dinheiro')),
  status         text not null default 'novo' check (status in ('novo', 'aceito', 'a_caminho', 'entregue', 'recusado', 'cancelado')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists pedidos_vendedor_idx on public.pedidos (vendedor, criado_em desc);
create index if not exists pedidos_cliente_idx on public.pedidos (cliente, criado_em desc);

-- ---------- hora da última mudança ----------
create or replace function public.marca_hora() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists vendedores_hora on public.vendedores;
create trigger vendedores_hora before insert or update on public.vendedores for each row execute function public.marca_hora();
drop trigger if exists pedidos_z_hora on public.pedidos;
create trigger pedidos_z_hora before insert or update on public.pedidos for each row execute function public.marca_hora();

-- ---------- regras do pedido: preço vem do banco, nunca do celular ----------
create or replace function public.pedido_novo() returns trigger
language plpgsql set search_path = '' as $$
declare
  item jsonb; p record; qtd int; total int := 0; lista jsonb := '[]'::jsonb;
begin
  if new.cliente is distinct from auth.uid() then raise exception 'Cliente inválido'; end if;
  new.status := 'novo';
  if not exists (select 1 from public.vendedores v
                 where v.id = new.vendedor and v.aberto and v.atualizado_em > now() - interval '12 hours') then
    raise exception 'Este vendedor está fechado agora';
  end if;
  if jsonb_typeof(new.itens) <> 'array' or jsonb_array_length(new.itens) = 0 or jsonb_array_length(new.itens) > 30 then
    raise exception 'Pedido vazio';
  end if;
  for item in select * from jsonb_array_elements(new.itens) loop
    qtd := (item ->> 'qtd')::int;
    if qtd is null or qtd < 1 or qtd > 50 then raise exception 'Quantidade inválida'; end if;
    select pr.id, pr.nome, pr.preco_centavos into p from public.produtos pr
      where pr.id = (item ->> 'produto')::uuid and pr.vendedor = new.vendedor and pr.disponivel;
    if not found then raise exception 'Um dos produtos acabou'; end if;
    lista := lista || jsonb_build_object('produto', p.id, 'nome', p.nome, 'preco_centavos', p.preco_centavos, 'qtd', qtd);
    total := total + p.preco_centavos * qtd;
  end loop;
  new.itens := lista;
  new.total_centavos := total;
  if (select count(*) from public.pedidos where cliente = new.cliente and criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitos pedidos em pouco tempo. Tente mais tarde.';
  end if;
  return new;
end $$;
drop trigger if exists pedidos_a_novo on public.pedidos;
create trigger pedidos_a_novo before insert on public.pedidos for each row execute function public.pedido_novo();

-- Só o status muda. Vendedor: aceita, recusa, sai para entregar, entrega. Cliente: cancela antes de aceitar.
create or replace function public.pedido_muda() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'status' - 'atualizado_em') is distinct from (to_jsonb(old) - 'status' - 'atualizado_em') then
    raise exception 'Só o andamento do pedido pode mudar';
  end if;
  if new.status = old.status then return new; end if;
  if auth.uid() = old.vendedor then
    if not ((old.status = 'novo' and new.status in ('aceito', 'recusado'))
         or (old.status = 'aceito' and new.status in ('a_caminho', 'entregue', 'recusado'))
         or (old.status = 'a_caminho' and new.status = 'entregue')) then
      raise exception 'Mudança de andamento não permitida';
    end if;
  elsif auth.uid() = old.cliente then
    if not (old.status = 'novo' and new.status = 'cancelado') then
      raise exception 'Só dá para cancelar antes do vendedor aceitar';
    end if;
  else
    raise exception 'Sem permissão';
  end if;
  return new;
end $$;
drop trigger if exists pedidos_b_muda on public.pedidos;
create trigger pedidos_b_muda before update on public.pedidos for each row execute function public.pedido_muda();

-- ---------- quem vê e quem mexe (RLS) ----------
alter table public.vendedores enable row level security;
alter table public.produtos enable row level security;
alter table public.pedidos enable row level security;

-- Vendedor aparece para o público só ABERTO e atualizado nas últimas 12 horas.
-- O cliente continua vendo o vendedor dos próprios pedidos.
drop policy if exists "vendedores: ver" on public.vendedores;
create policy "vendedores: ver" on public.vendedores for select using (
  (aberto and atualizado_em > now() - interval '12 hours')
  or id = (select auth.uid())
  or exists (select 1 from public.pedidos pe where pe.vendedor = vendedores.id and pe.cliente = (select auth.uid()))
);
drop policy if exists "vendedores: criar o próprio" on public.vendedores;
create policy "vendedores: criar o próprio" on public.vendedores for insert to authenticated
  with check (id = (select auth.uid()) and public.eh_vendedor_real());
drop policy if exists "vendedores: mudar o próprio" on public.vendedores;
create policy "vendedores: mudar o próprio" on public.vendedores for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "vendedores: apagar o próprio" on public.vendedores;
create policy "vendedores: apagar o próprio" on public.vendedores for delete to authenticated
  using (id = (select auth.uid()));

drop policy if exists "produtos: ver" on public.produtos;
create policy "produtos: ver" on public.produtos for select using (
  vendedor = (select auth.uid())
  or exists (select 1 from public.vendedores v where v.id = produtos.vendedor
             and v.aberto and v.atualizado_em > now() - interval '12 hours')
);
drop policy if exists "produtos: criar os próprios" on public.produtos;
create policy "produtos: criar os próprios" on public.produtos for insert to authenticated
  with check (vendedor = (select auth.uid()) and public.eh_vendedor_real());
drop policy if exists "produtos: mudar os próprios" on public.produtos;
create policy "produtos: mudar os próprios" on public.produtos for update to authenticated
  using (vendedor = (select auth.uid())) with check (vendedor = (select auth.uid()));
drop policy if exists "produtos: apagar os próprios" on public.produtos;
create policy "produtos: apagar os próprios" on public.produtos for delete to authenticated
  using (vendedor = (select auth.uid()));

drop policy if exists "pedidos: ver os seus" on public.pedidos;
create policy "pedidos: ver os seus" on public.pedidos for select to authenticated
  using (cliente = (select auth.uid()) or vendedor = (select auth.uid()));
drop policy if exists "pedidos: cliente pede" on public.pedidos;
create policy "pedidos: cliente pede" on public.pedidos for insert to authenticated
  with check (cliente = (select auth.uid()));
drop policy if exists "pedidos: andamento" on public.pedidos;
create policy "pedidos: andamento" on public.pedidos for update to authenticated
  using (cliente = (select auth.uid()) or vendedor = (select auth.uid()));

grant select on public.vendedores, public.produtos to anon, authenticated;
grant insert, update, delete on public.vendedores, public.produtos to authenticated;
grant select, insert, update on public.pedidos to authenticated;

-- ---------- fotos (até 1 MB; cada vendedor só mexe na própria pasta) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 1048576, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: vendedor envia" on storage.objects;
create policy "fotos: vendedor envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text and public.eh_vendedor_real());
drop policy if exists "fotos: vendedor troca" on storage.objects;
create policy "fotos: vendedor troca" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "fotos: vendedor apaga" on storage.objects;
create policy "fotos: vendedor apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- pedidos ao vivo (vendedor recebe na hora; cliente acompanha) ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos') then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;
