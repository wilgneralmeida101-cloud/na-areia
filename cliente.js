// Na Areia — app do cliente: quem está aberto na praia, vitrine com fotos, rota a pé e pedido.
(function () {
  const { $, esc } = U;
  const sb = U.nuvem("na-areia-cliente");
  const conteudo = $("conteudo");
  const E = {
    voce: null, vendedores: [], carregado: false, erro: null,
    busca: "", categoria: "tudo", modo: "lista",
    vitrine: null,                         // vendedor aberto na tela
    carrinho: JSON.parse(localStorage.getItem("na-areia-carrinho") || "{}"), // { vendedorId: { produtoId: qtd } }
    nome: localStorage.getItem("na-areia-nome") || "", referencia: "", pagamento: "pix",
  };
  const salvarCarrinho = () => localStorage.setItem("na-areia-carrinho", JSON.stringify(E.carrinho));
  let mapa = null;

  // ---------- dados ----------
  const CAMPOS = "id,nome,tipo,descricao,foto_url,whatsapp,pix_chave,faz_entrega,lat,lon,atualizado_em,produtos(id,nome,preco_centavos,categoria,foto_url,disponivel,ordem)";
  async function buscar() {
    const ficticios = Demo.ativo ? Demo.vendedores() : [];
    if (!sb) {
      if (Demo.ativo) { E.vendedores = ficticios.map(prepararVendedor); E.carregado = true; E.erro = null; } else E.erro = "preparando";
      return;
    }
    let q = sb.from("vendedores").select(CAMPOS).limit(300);
    if (E.voce) q = q.gte("lat", E.voce.lat - 0.3).lte("lat", E.voce.lat + 0.3).gte("lon", E.voce.lon - 0.3).lte("lon", E.voce.lon + 0.3);
    const { data, error } = await q;
    if (error && !Demo.ativo) { E.erro = "rede"; return; }
    E.erro = null;
    E.vendedores = (error ? [] : data).concat(ficticios).map(prepararVendedor);
    E.carregado = true;
  }
  function prepararVendedor(v) {
    v.produtos = (v.produtos || []).sort((a, b) => a.ordem - b.ordem);
    v.dist = E.voce ? U.distanciaM(E.voce, v) : null;
    return v;
  }
  async function buscarUm(id) {
    if (Demo.ativo) { const v = Demo.um(id); if (v) return prepararVendedor(v); }
    if (!sb) return null;
    const { data } = await sb.from("vendedores").select(CAMPOS).eq("id", id).maybeSingle();
    return data ? prepararVendedor(data) : null;
  }

  // ---------- lista / mapa ----------
  const semAcento = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function filtrados() {
    const q = semAcento(E.busca.trim());
    return E.vendedores
      .map(v => {
        const produtos = v.produtos.filter(p => p.disponivel && (E.categoria === "tudo" || p.categoria === E.categoria)
          && (!q || semAcento(p.nome).includes(q)));
        const nomeBate = q && (semAcento(v.nome).includes(q) || semAcento(v.descricao).includes(q));
        return Object.assign({}, v, { combinam: produtos, mostra: produtos.length > 0 || (nomeBate && E.categoria === "tudo") || (!q && E.categoria === "tudo") });
      })
      .filter(v => v.mostra)
      .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
  }
  function telaLista() {
    if (E.erro === "preparando") return `<div class="cartao vazio"><div class="emoji">🏗️</div><p>O Na Areia está quase pronto. Volte em breve!</p></div>`;
    const lista = filtrados();
    let html = `
      <div class="busca"><svg class="lupa" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>
        <input id="busca" class="entrada" type="search" placeholder="O que você quer? Ex.: milho, açaí" value="${esc(E.busca)}" autocomplete="off" enterkeyhint="search"></div>
      <div class="categorias">${[["tudo", "🏖️", "Tudo"], ...Object.entries(U.CATEGORIAS).map(([k, [e, t]]) => [k, e, t])].map(([k, e, t]) =>
        `<button type="button" data-categoria="${k}" class="${E.categoria === k ? "marcado" : ""}" aria-pressed="${E.categoria === k}"><span class="emoji">${e}</span>${t}</button>`).join("")}</div>
      ${E.erro === "rede" ? `<div class="alerta">Sem conexão agora. Mostrando o que já tinha.</div>` : ""}
      ${!E.voce ? `<button class="botao secundario pequeno" data-acao="localizar">📍 Mostrar o que está perto de mim</button>` : ""}`;
    if (E.modo === "mapa") return html + (E.carregado ? `<div id="mapa"></div>` : `<p class="suave">Procurando bancas…</p>`);
    if (!E.carregado) return html + `<p class="suave">Procurando bancas…</p>`;
    if (!lista.length) return html + `<div class="cartao vazio"><div class="emoji">🌴</div>
      <p>${E.busca || E.categoria !== "tudo" ? "Ninguém aberto com isso por perto agora." : "Nenhuma banca aberta por perto agora."}</p>
      <p class="nota">As bancas e os ambulantes aparecem quando abrem no app do vendedor.</p></div>`;
    return html + `<div class="cabeca-lista"><h2>${lista.length} ${lista.length === 1 ? "aberto agora" : "abertos agora"}</h2>${E.voce ? `<span>mais perto primeiro</span>` : ""}</div>` + lista.map(v => {
      const itens = (E.busca || E.categoria !== "tudo" ? v.combinam : v.produtos.filter(p => p.disponivel));
      return `
      <a class="loja" href="#/v/${v.id}">
        <div class="capa" style="${v.foto_url ? `background-image:url('${esc(v.foto_url)}')` : ""}">${v.foto_url ? "" : v.tipo === "ambulante" ? "🚶" : "🏖️"}</div>
        <div class="info">
          <div class="nome-loja">${esc(v.nome)}</div>
          <div class="detalhe">${v.tipo === "ambulante" ? "Ambulante" : "Banca"}${v.dist != null ? ` · ${U.textoDistancia(v.dist)}` : ""}</div>
          ${itens.length ? `<div class="tem">${itens.slice(0, 3).map(p => `${esc(p.nome)} <b>${U.reais(p.preco_centavos)}</b>`).join(" · ")}</div>` : ""}
          <div class="etiquetas"><span class="etiqueta verde"><i class="ponto"></i>Aberto</span>${v.faz_entrega ? `<span class="etiqueta azul">🛵 Entrega</span>` : `<span class="etiqueta">Retirar no local</span>`}</div>
        </div>
        <span class="seta" aria-hidden="true">›</span>
      </a>`;
    }).join("");
  }
  let marcadores = new Map();
  const iconeVendedor = v => L.divIcon({ className: "", iconSize: [44, 44], iconAnchor: [22, 22],
    html: `<div class="pino" style="${v.foto_url ? `background-image:url('${esc(v.foto_url)}')` : ""}">${v.foto_url ? "" : v.tipo === "ambulante" ? "🚶" : "🏖️"}</div>` });
  function popupVendedor(v) { return `<b>${esc(v.nome)}</b>${v.dist != null ? `<br>${U.textoDistancia(v.dist)}` : ""}<br><a href="#/v/${v.id}">Ver vitrine →</a>`; }
  // Atualiza só as posições (ambulantes andando), sem piscar o mapa.
  function atualizarMarcadores() {
    if (!mapa || !$("mapa")) return;
    const lista = filtrados(), ids = new Set(lista.map(v => v.id));
    marcadores.forEach((m, id) => { if (!ids.has(id)) { m.remove(); marcadores.delete(id); } });
    lista.forEach(v => {
      const m = marcadores.get(v.id);
      if (m) { m.setLatLng([v.lat, v.lon]); m.setPopupContent(popupVendedor(v)); }
      else marcadores.set(v.id, L.marker([v.lat, v.lon], { icon: iconeVendedor(v), title: v.nome }).addTo(mapa).bindPopup(popupVendedor(v)));
    });
  }
  // O mapa ocupa o resto da tela do celular, sem precisar rolar.
  function ajustarAlturaMapa() {
    const el = $("mapa"); if (!el) return;
    const menu = document.querySelector(".abas, nav");
    const baixo = menu && getComputedStyle(menu).position === "fixed" ? menu.offsetHeight : 0;
    const topo = el.getBoundingClientRect().top + window.scrollY;
    el.style.height = Math.max(300, window.innerHeight - topo - baixo - 16) + "px";
  }
  function desenharMapa() {
    if (!$("mapa")) return;
    if (mapa) mapa.remove();
    marcadores = new Map();
    const lista = filtrados();
    ajustarAlturaMapa();
    mapa = L.map("mapa").setView(E.voce ? [E.voce.lat, E.voce.lon] : [-3.74, -38.45], E.voce ? 15 : 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mapa);
    if (E.voce) L.marker([E.voce.lat, E.voce.lon], { icon: L.divIcon({ className: "", html: '<div class="voce"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(mapa);
    atualizarMarcadores();
    if (!E.voce && lista.length) mapa.fitBounds(L.latLngBounds(lista.map(v => [v.lat, v.lon])).pad(0.3), { maxZoom: 15 });
  }

  // ---------- vitrine ----------
  const carrinhoDe = id => E.carrinho[id] || (E.carrinho[id] = {});
  function itensDoCarrinho(v) {
    const c = E.carrinho[v.id] || {};
    return v.produtos.filter(p => p.disponivel && c[p.id] > 0).map(p => ({ p, qtd: c[p.id] }));
  }
  function telaVitrine() {
    const v = E.vitrine;
    if (v === "fechado") return `<button class="link-botao" style="text-align:left" data-acao="inicio">← Ver quem está aberto</button>
      <div class="cartao vazio"><div class="emoji">🌙</div><p><b>Fechado agora.</b></p><p class="suave">Esse vendedor não está aberto neste momento. Veja quem está perto.</p></div>`;
    const c = carrinhoDe(v.id);
    const porCategoria = Object.keys(U.CATEGORIAS).map(k => [k, v.produtos.filter(p => p.categoria === k)]).filter(([, ps]) => ps.length);
    return `
      <div class="vitrine-capa" style="${v.foto_url ? `background-image:url('${esc(v.foto_url)}')` : ""}">${v.foto_url ? "" : v.tipo === "ambulante" ? "🚶" : "🏖️"}
        <button class="voltar" data-acao="inicio" aria-label="Voltar">←</button></div>
      <div class="vitrine-cabeca">
        <h1>${esc(v.nome)}</h1>
        ${v.descricao ? `<p class="suave">${esc(v.descricao)}</p>` : ""}
        <div class="etiquetas" style="display:flex;flex-wrap:wrap;gap:6px">
          <span class="etiqueta verde">● Aberto</span>
          <span class="etiqueta">${v.tipo === "ambulante" ? "🚶 Ambulante" : "🏖️ Banca"}</span>
          ${v.dist != null ? `<span class="etiqueta">${U.textoDistancia(v.dist)}</span>` : ""}
          ${v.faz_entrega ? `<span class="etiqueta azul">🛵 Leva até você</span>` : ""}
        </div>
        <div class="acoes">
          <a class="botao" href="${U.linkRota(v.lat, v.lon)}" target="_blank" rel="noopener">🚶 Como chegar</a>
          ${v.whatsapp ? `<a class="botao whats" href="${U.linkWhats(v.whatsapp, `Olá! Vi sua vitrine no Na Areia.`)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
        </div>
        ${v.tipo === "ambulante" ? `<p class="nota">Ambulante anda pela praia. Posição de ${U.haQuanto(v.atualizado_em)}.</p>` : ""}
      </div>
      ${porCategoria.map(([k, ps]) => `
        <h2>${U.CATEGORIAS[k][0]} ${U.CATEGORIAS[k][1]}</h2>
        <div class="cartao">${ps.map(p => `
          <div class="item ${p.disponivel ? "" : "acabou"}">
            <div class="info">
              <div class="nome-item">${esc(p.nome)}</div>
              <div class="preco">${U.reais(p.preco_centavos)}</div>
              ${!p.disponivel ? `<span class="etiqueta vermelha" style="margin-top:6px">Acabou</span>`
                : c[p.id] ? `<div class="qtd"><button data-menos="${p.id}" aria-label="Menos">−</button><span class="n">${c[p.id]}</span><button data-mais="${p.id}" aria-label="Mais">+</button></div>`
                : `<div class="qtd"><button class="adicionar" data-mais="${p.id}">+ Adicionar</button></div>`}
            </div>
            <div class="foto" style="${p.foto_url ? `background-image:url('${esc(p.foto_url)}')` : ""}">${p.foto_url ? "" : U.CATEGORIAS[p.categoria][0]}</div>
          </div>`).join("")}</div>`).join("")}
      ${v.pix_chave ? `<div class="cartao"><div class="titulo-cartao"><span class="emoji">💠</span>Pagar com Pix</div>
        <div class="pix"><code>${esc(v.pix_chave)}</code><button class="botao-icone" data-acao="copiar-pix" aria-label="Copiar chave Pix">📋</button></div>
        <p class="nota">O dinheiro vai direto para o vendedor.</p></div>` : ""}`;
  }
  function barraPedido() {
    atualizarMenu();
    const barra = $("barra-pedido");
    const v = E.vitrine;
    if (!v || v === "fechado" || location.hash.startsWith("#/pedido")) { barra.hidden = true; return; }
    const itens = itensDoCarrinho(v);
    const total = itens.reduce((a, x) => a + x.qtd * x.p.preco_centavos, 0);
    barra.hidden = !itens.length;
    barra.innerHTML = itens.length ? `<a class="botao verde" href="#/pedido/${v.id}"><span>🧺 Ver pedido (${itens.reduce((a, x) => a + x.qtd, 0)})</span><span>${U.reais(total)}</span></a>` : "";
  }

  // ---------- pedido (fase 1: vai pelo WhatsApp do vendedor) ----------
  function telaPedido() {
    const v = E.vitrine;
    const itens = itensDoCarrinho(v);
    const total = itens.reduce((a, x) => a + x.qtd * x.p.preco_centavos, 0);
    if (!itens.length) return `<button class="link-botao" style="text-align:left" data-acao="voltar-vitrine">← Voltar</button><div class="cartao vazio"><p>Seu pedido está vazio.</p></div>`;
    return `
      <button class="link-botao" style="text-align:left" data-acao="voltar-vitrine">← Voltar</button>
      <h1>Seu pedido</h1>
      <div class="cartao">
        ${itens.map(x => `<div class="resumo-item"><span>${x.qtd}× ${esc(x.p.nome)}</span><b>${U.reais(x.qtd * x.p.preco_centavos)}</b></div>`).join("")}
        <div class="total"><span>Total</span><span>${U.reais(total)}</span></div>
      </div>
      <div class="cartao">
        <div class="campo"><label for="seu-nome">Seu nome</label><input id="seu-nome" class="entrada" maxlength="30" value="${esc(E.nome)}" autocomplete="given-name"></div>
        ${v.faz_entrega ? `
          <div class="campo"><label for="referencia">Onde você está na areia?</label>
            <input id="referencia" class="entrada" maxlength="120" placeholder="Ex.: guarda-sol azul em frente à barraca 12" value="${esc(E.referencia)}">
            <p class="nota">${E.voce ? "📍 Sua localização vai junto, para o vendedor te achar." : "Dica: libere a localização para o vendedor te achar mais fácil."}</p></div>`
          : `<p class="nota">Esse vendedor não leva até você: o pedido fica separado para você buscar.</p>`}
        <div class="campo"><span class="pergunta">Pagamento</span>
          <div class="escolha" data-grupo="pagamento">
            ${v.pix_chave ? `<button type="button" data-valor="pix" class="${E.pagamento === "pix" ? "marcado" : ""}"><span class="emoji">💠</span>Pix</button>` : ""}
            <button type="button" data-valor="dinheiro" class="${E.pagamento === "dinheiro" || !v.pix_chave ? "marcado" : ""}"><span class="emoji">💵</span>Dinheiro</button>
          </div></div>
      </div>
      ${v.whatsapp
        ? Demo.ativo
          ? `<button class="botao verde" data-acao="enviar-whats">🧺 Fazer pedido</button>
             <p class="nota" style="text-align:center">Homologação: o pedido é simulado e você acompanha cada passo.</p>`
          : `<button class="botao whats" data-acao="enviar-whats">💬 Enviar pedido pelo WhatsApp</button>
           <p class="nota" style="text-align:center">Abre o WhatsApp do vendedor com o pedido pronto. É só tocar em enviar.</p>`
        : `<div class="alerta">Esse vendedor ainda não recebe pedidos pelo celular. Vá até ele e mostre esta tela.</div>
           <a class="botao" href="${U.linkRota(v.lat, v.lon)}" target="_blank" rel="noopener">🚶 Como chegar</a>`}`;
  }
  function mensagemPedido(v) {
    const itens = itensDoCarrinho(v);
    const total = itens.reduce((a, x) => a + x.qtd * x.p.preco_centavos, 0);
    const linhas = [`🏖️ *Pedido pelo Na Areia*`, "", ...itens.map(x => `${x.qtd}× ${x.p.nome} — ${U.reais(x.qtd * x.p.preco_centavos)}`),
      `*Total: ${U.reais(total)}*`, "", `Nome: ${E.nome}`];
    if (v.faz_entrega) {
      if (E.referencia) linhas.push(`Onde estou: ${E.referencia}`);
      if (E.voce) linhas.push(`📍 https://maps.google.com/?q=${E.voce.lat},${E.voce.lon}`);
    } else linhas.push("Vou buscar na banca.");
    linhas.push(`Pagamento: ${E.pagamento === "pix" ? "Pix" : "Dinheiro"}`);
    return linhas.join("\n");
  }

  // ---------- acompanhar pedido (na demonstração; na fase 2 vem do banco) ----------
  const PASSOS = [["novo", "📨", "Pedido enviado", "Esperando o vendedor ver"], ["aceito", "👍", "Aceito", "O vendedor está preparando"],
    ["a_caminho", "🛵", "A caminho", "Indo até você na areia"], ["entregue", "✅", "Entregue", "Bom proveito!"]];
  let mapaPedido = null, marcaVendedor = null, marcaEntrega = null, linhaEntrega = null;
  function telaAcompanhar() {
    const p = Demo.ativo && Demo.pedido();
    if (!p) return `<button class="link-botao" style="text-align:left" data-acao="inicio">← Início</button><div class="cartao vazio"><p>Nenhum pedido em andamento.</p></div>`;
    const v = p.vendedor, idx = PASSOS.findIndex(x => x[0] === p.status);
    const total = p.itens.reduce((a, x) => a + x.qtd * x.preco_centavos, 0);
    if (p.status === "cancelado") return `<h1>Pedido cancelado</h1><button class="botao" data-acao="inicio">Voltar ao início</button>`;
    return `
      <h1>Pedido #${p.codigo}</h1>
      <p class="suave">${esc(v.nome)}</p>
      ${p.status === "a_caminho" || p.status === "aceito" ? `<div id="mapa-pedido"></div><div id="falta-pedido" class="falta-pedido"></div>` : ""}
      <div class="cartao passos-pedido">${PASSOS.map(([st, em, titulo, sub], i) => `
        <div class="passo-pedido ${i < idx ? "feito" : i === idx ? "atual" : ""}">
          <span class="bolinha">${i <= idx ? em : "○"}</span>
          <div><b>${titulo}</b>${i === idx ? `<div class="nota" style="margin:0">${sub}</div>` : ""}</div>
        </div>`).join("")}</div>
      <div class="cartao">
        ${p.itens.map(x => `<div class="resumo-item"><span>${x.qtd}× ${esc(x.nome)}</span><b>${U.reais(x.qtd * x.preco_centavos)}</b></div>`).join("")}
        <div class="total"><span>Total</span><span>${U.reais(total)}</span></div>
        ${p.cliente.pagamento === "pix" && v.pix_chave ? `<div class="pix" style="margin-top:12px"><code>${esc(v.pix_chave)}</code><button class="botao-icone" data-acao="copiar-pix-pedido" aria-label="Copiar chave Pix">📋</button></div>
          <p class="nota">Pague pelo Pix quando o vendedor aceitar.</p>` : `<p class="nota">Pagamento em dinheiro na entrega.</p>`}
      </div>
      ${p.status === "novo" ? `<button class="botao perigo" data-acao="cancelar-pedido">Cancelar pedido</button>` : ""}
      ${p.status === "entregue" ? `<button class="botao" data-acao="inicio">Fazer outro pedido</button>` : ""}
      <a class="botao whats pequeno" href="${U.linkWhats(v.whatsapp, `Olá! Sobre o pedido #${p.codigo}.`)}" target="_blank" rel="noopener">💬 Falar com o vendedor</a>`;
  }
  const iconeEntrega = L.divIcon({ className: "", iconSize: [54, 54], iconAnchor: [27, 27], html: '<div class="entregador">🛵</div>' });
  function desenharMapaPedido() {
    const p = Demo.ativo && Demo.pedido();
    if (!p || !$("mapa-pedido")) { mapaPedido = null; return; }
    const v = p.vendedor, c = p.cliente, e = p.entregador;
    if (!mapaPedido || !document.body.contains(mapaPedido.getContainer())) {
      mapaPedido = L.map("mapa-pedido", { zoomControl: false }).setView([v.lat, v.lon], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(mapaPedido);
      if (c.lat) L.marker([c.lat, c.lon], { zIndexOffset: 500, icon: L.divIcon({ className: "", html: '<div class="voce-pedido"><div class="voce"></div><span>Você</span></div>', iconSize: [60, 44], iconAnchor: [30, 9] }) }).addTo(mapaPedido);
      marcaVendedor = L.marker([v.lat, v.lon], { icon: iconeVendedor(v) }).addTo(mapaPedido);
      marcaEntrega = e ? L.marker([e.lat, e.lon], { icon: iconeEntrega, zIndexOffset: 1000 }).addTo(mapaPedido) : null;
      linhaEntrega = e && c.lat ? L.polyline([[e.lat, e.lon], [c.lat, c.lon]], { color: "#1351b4", weight: 4, dashArray: "8 10" }).addTo(mapaPedido) : null;
      if (c.lat) mapaPedido.fitBounds([[v.lat, v.lon], [c.lat, c.lon]], { padding: [50, 50], maxZoom: 17 });
    } else {
      marcaVendedor.setLatLng([v.lat, v.lon]);
      if (e && marcaEntrega) marcaEntrega.setLatLng([e.lat, e.lon]);
      if (e && linhaEntrega) linhaEntrega.setLatLngs([[e.lat, e.lon], [c.lat, c.lon]]);
    }
    const falta = $("falta-pedido");
    if (falta) {
      if (e && c.lat) {
        const m = U.distanciaM(e, c);
        falta.innerHTML = m < 15 ? "🛵 Chegando! Olhe em volta." : `🛵 Entregador a <b>${U.textoDistancia(m)}</b> de você`;
      } else falta.textContent = "👍 O vendedor está preparando. Logo sai para entrega.";
    }
  }
  let ultimoStatus = null;
  setInterval(() => { // acompanha o pedido em andamento
    if (location.hash !== "#/acompanhar") return;
    const p = Demo.ativo && Demo.pedido();
    if (p && p.status !== ultimoStatus) {
      ultimoStatus = p.status;
      conteudo.innerHTML = telaAcompanhar(); mapaPedido = null;
      if (navigator.vibrate) navigator.vibrate(150);
    }
    desenharMapaPedido();
  }, 1000);

  // ---------- navegação por endereço (#/v/ID compartilhável) ----------
  async function rota() {
    const h = location.hash;
    const m = h.match(/^#\/(v|pedido)\/([0-9a-f-]{36})/);
    if (h === "#/acompanhar") {
      E.vitrine = null; ultimoStatus = null; mapaPedido = null;
      conteudo.innerHTML = `<div class="entrar">${telaAcompanhar()}</div>`;
      desenharMapaPedido(); barraPedido(); window.scrollTo(0, 0);
      return;
    }
    if (m) {
      const id = m[2];
      let v = E.vendedores.find(x => x.id === id);
      const desenhar = () => { conteudo.innerHTML = `<div class="entrar">${m[1] === "pedido" && E.vitrine !== "fechado" ? telaPedido() : telaVitrine()}</div>`; barraPedido(); };
      if (v) { E.vitrine = v; desenhar(); } else conteudo.innerHTML = `<p class="suave">Abrindo vitrine…</p>`;
      // Sempre confere de novo: o vendedor pode ter fechado ou mudado produtos.
      const fresco = await buscarUm(id);
      if (location.hash !== h) return;
      E.vitrine = fresco || "fechado";
      if (fresco) E.vendedores = E.vendedores.map(x => (x.id === id ? fresco : x)); else E.vendedores = E.vendedores.filter(x => x.id !== id);
      desenhar();
    } else {
      E.vitrine = null;
      conteudo.innerHTML = `<div class="entrar">${telaLista()}</div>`;
      if (E.modo === "mapa") desenharMapa();
    }
    barraPedido();
    window.scrollTo(0, 0);
  }
  function redesenhar() { // mantém a rolagem e o foco da busca
    const y = window.scrollY, focoBusca = document.activeElement && document.activeElement.id === "busca";
    if (!location.hash.startsWith("#/")) {
      conteudo.innerHTML = telaLista();
      if (E.modo === "mapa") desenharMapa();
      if (focoBusca) { const b = $("busca"); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    } else if (E.vitrine && E.vitrine !== "fechado" && location.hash.startsWith("#/v/")) conteudo.innerHTML = telaVitrine();
    barraPedido();
    window.scrollTo(0, y);
  }

  function localizar() {
    // Homologação: a pessoa "está" na praia escolhida (sem usar o GPS de verdade).
    if (Demo.ativo && Demo.modoLocal() === "simulado") {
      E.voce = Object.assign({}, Demo.centro);
      $("onde").textContent = `🧪 ${Demo.lugares[Demo.lugar()].nome}`;
      return atualizar();
    }
    U.posicao().then(pos => {
      E.voce = pos;
      $("onde").textContent = "Minha localização real";
      return atualizar();
    }).catch(() => { $("onde").textContent = "Toque para usar sua localização"; });
  }
  async function atualizar() {
    await buscar();
    if (!location.hash.startsWith("#/")) redesenhar();
  }

  // ---------- folha "onde você está" (homologação) ----------
  function abrirFolha() {
    const f = $("folha"), simulado = Demo.modoLocal() === "simulado";
    f.innerHTML = `<div class="folha-fundo" data-acao="fechar-folha"></div>
      <div class="folha" role="dialog" aria-modal="true" aria-labelledby="folha-titulo">
        <div class="puxador"></div>
        <h2 id="folha-titulo">Onde você está?</h2>
        <div class="alternar">
          <button data-modo-local="simulado" class="${simulado ? "marcado" : ""}">🧪 Simulada</button>
          <button data-modo-local="real" class="${!simulado ? "marcado" : ""}">📍 GPS real</button></div>
        ${simulado ? `<div class="lugares">${Object.entries(Demo.lugares).map(([k, l]) => `
          <button type="button" data-lugar="${k}" class="${k === Demo.lugar() ? "marcado" : ""}"><span>${l.nome}</span>${k === Demo.lugar() ? "<b>✓</b>" : ""}</button>`).join("")}</div>`
        : `<p class="nota">Usando o GPS do celular. Longe de Fortaleza, as bancas fictícias aparecem bem distantes.</p>`}
        <button class="botao secundario pequeno" data-acao="fechar-folha">Fechar</button>
      </div>`;
    f.hidden = false;
  }
  function fecharFolha() { $("folha").hidden = true; }
  // Menu de baixo: só nas telas principais; marca onde a pessoa está.
  function atualizarMenu() {
    const h = location.hash, menu = $("menu");
    menu.hidden = !!h && h !== "#/acompanhar";
    menu.querySelectorAll("[data-modo]").forEach(b => b.setAttribute("aria-current", !h && E.modo === b.dataset.modo ? "page" : "false"));
    const ap = $("aba-pedido");
    ap.hidden = !Demo.ativo;
    ap.setAttribute("aria-current", h === "#/acompanhar" ? "page" : "false");
    const p = Demo.ativo && Demo.pedido();
    $("aviso-pedido").hidden = !(p && !["entregue", "cancelado"].includes(p.status));
    document.body.classList.toggle("com-menu", !menu.hidden);
  }
  setInterval(atualizarMenu, 2000);

  // ---------- toques ----------
  document.addEventListener("click", e => {
    const t = e.target;
    const cat = t.closest("[data-categoria]");
    if (cat) { E.categoria = cat.dataset.categoria; return redesenhar(); }
    const ml = t.closest("[data-modo-local]");
    if (ml) { Demo.definirModoLocal(ml.dataset.modoLocal); abrirFolha(); localizar(); if (ml.dataset.modoLocal === "real") fecharFolha(); return; }
    const modo = t.closest("[data-modo]");
    if (modo) { E.modo = modo.dataset.modo; if (location.hash) location.hash = ""; else redesenhar(); return; }
    const lg = t.closest("[data-lugar]");
    if (lg) { Demo.definirLugar(lg.dataset.lugar); fecharFolha(); localizar(); U.avisar(`Você está em ${Demo.lugares[lg.dataset.lugar].nome}`); return; }
    const mais = t.closest("[data-mais]"), menos = t.closest("[data-menos]");
    if (mais || menos) {
      const c = carrinhoDe(E.vitrine.id), id = (mais || menos).dataset[mais ? "mais" : "menos"];
      c[id] = Math.max(0, Math.min(50, (c[id] || 0) + (mais ? 1 : -1)));
      if (!c[id]) delete c[id];
      salvarCarrinho();
      return redesenhar();
    }
    const op = t.closest(".escolha [data-valor]");
    if (op) { op.parentElement.querySelectorAll("button").forEach(b => b.classList.toggle("marcado", b === op)); E.pagamento = op.dataset.valor; return; }
    const a = t.closest("[data-acao]");
    if (!a) return;
    const acao = a.dataset.acao;
    if (acao === "inicio") location.hash = "";
    if (acao === "voltar-vitrine") location.hash = `#/v/${E.vitrine.id}`;
    if (acao === "localizar") localizar();
    if (acao === "trocar-local") { if (Demo.ativo) abrirFolha(); else localizar(); }
    if (acao === "fechar-folha") fecharFolha();
    if (acao === "meu-pedido") location.hash = "#/acompanhar";
    if (acao === "copiar-pix") U.copiar(E.vitrine.pix_chave, "Chave Pix copiada");
    if (acao === "copiar-pix-pedido") U.copiar(Demo.pedido().vendedor.pix_chave, "Chave Pix copiada");
    if (acao === "cancelar-pedido") { Demo.cancelar(); ultimoStatus = null; }
    if (acao === "enviar-whats") {
      E.nome = $("seu-nome").value.trim();
      if ($("referencia")) E.referencia = $("referencia").value.trim();
      if (!E.nome) return U.avisar("Coloque seu nome");
      if (E.vitrine.faz_entrega && !E.referencia && !E.voce) return U.avisar("Diga onde você está na areia");
      localStorage.setItem("na-areia-nome", E.nome);
      const v = E.vitrine;
      if (Demo.ativo) {
        const itens = itensDoCarrinho(v).map(x => ({ nome: x.p.nome, preco_centavos: x.p.preco_centavos, qtd: x.qtd }));
        Demo.fazerPedido(v.id, itens, { nome: E.nome, referencia: E.referencia, pagamento: E.pagamento, lat: E.voce && E.voce.lat, lon: E.voce && E.voce.lon });
        delete E.carrinho[v.id]; salvarCarrinho();
        location.hash = "#/acompanhar";
        return;
      }
      window.open(U.linkWhats(v.whatsapp, mensagemPedido(v)), "_blank");
      delete E.carrinho[v.id]; salvarCarrinho();
      setTimeout(() => { location.hash = `#/v/${v.id}`; U.avisar("Pedido enviado pelo WhatsApp"); }, 400);
    }
  });
  document.addEventListener("change", e => {
    if (e.target.id === "lugar-sim") { Demo.definirLugar(e.target.value); localizar(); if (E.modo === "mapa") redesenhar(); U.avisar(`Você está em ${Demo.lugares[e.target.value].nome}`); }
  });
  document.addEventListener("input", e => {
    if (e.target.id === "busca") { E.busca = e.target.value; redesenhar(); }
    if (e.target.id === "seu-nome") E.nome = e.target.value;
    if (e.target.id === "referencia") E.referencia = e.target.value;
  });
  window.addEventListener("hashchange", rota);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});

  // ---------- começo ----------
  (async () => {
    await buscar();
    rota();
    localizar();
    if (Demo.ativo) {
      document.body.insertAdjacentHTML("afterbegin", `<div class="faixa-demo">🧪 <b>Homologação</b> · dados fictícios · <a href="?sair-demo">ver reais</a></div>`);
      let ultimaBuscaReal = 0;
      setInterval(async () => {
        if (Date.now() - ultimaBuscaReal > 60e3) { await buscar(); ultimaBuscaReal = Date.now(); }
        else { const reais = E.vendedores.filter(v => !v.id.startsWith("d0000000")); E.vendedores = reais.concat(Demo.vendedores().map(prepararVendedor)); }
        const h = location.hash;
        if (!h.startsWith("#/")) { if (E.modo === "mapa") atualizarMarcadores(); else if (document.activeElement.id !== "busca") redesenhar(); }
        else if (h.startsWith("#/v/") && E.vitrine && E.vitrine !== "fechado") {
          const v = E.vendedores.find(x => x.id === E.vitrine.id);
          if (v) { E.vitrine = v; redesenhar(); }
        }
      }, 5000);
    } else setInterval(atualizar, 60e3);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizar(); });
  })();
})();
