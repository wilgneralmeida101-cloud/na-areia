// Na Areia — área do vendedor: entrar com código por e-mail, montar a vitrine e abrir a banca.
(function () {
  const { $, esc } = U;
  const sb = U.nuvem("na-areia-vendedor");
  const conteudo = $("conteudo");
  const E = {
    tela: "carregando", eu: null, perfil: null, produtos: [],
    email: "", etapaLogin: "email",
    editando: null,        // produto em edição: null | "novo" | id
    rascunho: null,        // campos do formulário em edição
    fotoNova: null,        // { blob, url } da foto escolhida e ainda não enviada
    fotoPara: null,        // "perfil" | "produto"
    ocupado: false,
  };

  const SUGESTOES = {
    bebida: ["Água de coco", "Água mineral", "Refrigerante lata", "Cerveja lata", "Caipirinha", "Suco natural"],
    lanche: ["Milho cozido", "Queijo coalho", "Sanduíche natural", "Pastel", "Tapioca", "Espetinho"],
    doce: ["Picolé", "Açaí", "Cocada", "Sorvete", "Bolo de pote", "Brigadeiro"],
    petisco: ["Camarão", "Batata frita", "Amendoim", "Castanha", "Ostra", "Caranguejo"],
    outro: ["Protetor solar", "Canga", "Chapéu", "Óculos de sol"],
  };

  // ---------- ajudantes ----------
  function escolha(grupo, opcoes, marcado) {
    return `<div class="escolha" data-grupo="${grupo}">${opcoes.map(([v, t, e]) =>
      `<button type="button" data-valor="${v}" class="${v === marcado ? "marcado" : ""}">${e ? `<span class="emoji">${e}</span>` : ""}${t}</button>`).join("")}</div>`;
  }
  const valorEscolha = g => { const b = document.querySelector(`[data-grupo="${g}"] .marcado`); return b ? b.dataset.valor : null; };
  function mensagemErro(e) {
    const m = (e && (e.message || e.error_description)) || "";
    if (/rate|too many|security purposes/i.test(m)) return "Muitas tentativas. Espere um minuto e tente de novo.";
    if (/token|otp|expired|invalid/i.test(m)) return "Código errado ou vencido. Peça outro.";
    if (/fetch|network|Failed/i.test(m)) return "Sem internet. Tente de novo.";
    if (/denied|permission|location/i.test(m)) return "Libere a localização do celular e tente de novo.";
    return m || "Não deu certo. Tente de novo.";
  }
  async function tentar(fn, aviso) {
    if (E.ocupado) return;
    E.ocupado = true;
    try { await fn(); if (aviso) U.avisar(aviso); }
    catch (e) { console.error(e); U.avisar(mensagemErro(e)); }
    finally { E.ocupado = false; }
  }
  const linkVitrine = () => new URL(`../#/v/${E.eu.id}`, location.href).href;

  // ---------- dados ----------
  async function carregar() {
    const { data: perfil, error } = await sb.from("vendedores").select("*").eq("id", E.eu.id).maybeSingle();
    if (error) throw error;
    E.perfil = perfil;
    if (perfil) {
      const r = await sb.from("produtos").select("*").eq("vendedor", E.eu.id).order("ordem").order("criado_em");
      if (r.error) throw r.error;
      E.produtos = r.data;
    }
  }
  async function enviarFoto(blob, nome) {
    const caminho = `${E.eu.id}/${nome}-${Date.now()}.jpg`;
    const { error } = await sb.storage.from("fotos").upload(caminho, blob, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    return sb.storage.from("fotos").getPublicUrl(caminho).data.publicUrl;
  }
  async function mudarPerfil(campos) {
    const { data, error } = await sb.from("vendedores").update(campos).eq("id", E.eu.id).select().single();
    if (error) throw error;
    E.perfil = data;
  }

  // =====================================================================
  // ENTRAR (código por e-mail)
  // =====================================================================
  function telaEntrar() {
    if (E.etapaLogin === "codigo") return `
      <h1>Digite o código</h1>
      <div class="cartao">
        <p>Mandamos um código para <b>${esc(E.email)}</b>. Abra seu e-mail e digite os números aqui.</p>
        <div class="campo"><label for="codigo">Código</label>
          <input id="codigo" class="entrada codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="000000"></div>
        <button class="botao" data-acao="verificar">Entrar</button>
        <button class="link-botao" data-acao="outro-email">Usar outro e-mail ou pedir de novo</button>
        <p class="nota">Não chegou? Olhe a caixa de spam (lixo eletrônico).</p>
      </div>`;
    return `
      <h1>Venda na areia 🏖️</h1>
      <div class="cartao">
        <p>Monte a vitrine da sua banca ou do seu carrinho e apareça para os clientes da praia.</p>
        <div class="campo"><label for="email">Seu e-mail</label>
          <input id="email" class="entrada" type="email" inputmode="email" autocomplete="email" placeholder="voce@email.com" value="${esc(E.email)}"></div>
        <button class="botao" data-acao="pedir-codigo">Receber código</button>
        <p class="nota">Sem senha: a cada entrada, chega um código no seu e-mail.</p>
      </div>`;
  }

  // =====================================================================
  // CADASTRO / MINHA BANCA
  // =====================================================================
  function telaPerfil() {
    const p = E.perfil || {};
    const r = E.rascunho || (E.rascunho = {
      nome: p.nome || "", tipo: p.tipo || "banca", descricao: p.descricao || "",
      whatsapp: p.whatsapp ? U.whatsMostrar(p.whatsapp) : "", pix: p.pix_chave || "", entrega: p.faz_entrega ? "sim" : "nao",
    });
    const foto = E.fotoPara === "perfil" && E.fotoNova ? E.fotoNova.url : p.foto_url;
    const primeira = !E.perfil;
    return `
      ${primeira ? `<h1>Vamos montar sua vitrine</h1><p>Leva 2 minutos. Depois você cadastra os produtos.</p>` : `<h1>Minha banca</h1>`}
      <div class="cartao">
        <div class="campo"><span class="pergunta">Foto da banca ou do carrinho</span>
          <button type="button" class="foto-quadro ${foto ? "tem" : ""}" data-acao="escolher-foto" data-para="perfil" style="${foto ? `background-image:url('${esc(foto)}')` : ""}">
            ${foto ? "" : `<span class="chamada"><span class="emoji">📷</span>Tirar ou escolher foto</span>`}</button>
          ${foto ? `<button class="link-botao" data-acao="escolher-foto" data-para="perfil">Trocar foto</button>` : ""}</div>
        <div class="campo"><label for="p-nome">Nome</label>
          <input id="p-nome" class="entrada" maxlength="40" placeholder="Ex.: Milho do Seu João" value="${esc(r.nome)}"></div>
        <div class="campo"><span class="pergunta">Você é</span>
          ${escolha("tipo", [["banca", "Banca fixa", "🏖️"], ["ambulante", "Ambulante", "🚶"]], r.tipo)}</div>
        <div class="campo"><label for="p-desc">O que você vende, em poucas palavras</label>
          <input id="p-desc" class="entrada" maxlength="140" placeholder="Ex.: Milho, queijo coalho e água gelada" value="${esc(r.descricao)}"></div>
        <div class="campo"><label for="p-whats">WhatsApp (com DDD)</label>
          <input id="p-whats" class="entrada" type="tel" inputmode="tel" placeholder="(85) 99999-9999" value="${esc(r.whatsapp)}"></div>
        <div class="campo"><label for="p-pix">Chave Pix</label>
          <input id="p-pix" class="entrada" maxlength="77" placeholder="Celular, CPF, e-mail ou chave aleatória" value="${esc(r.pix)}">
          <p class="nota">O cliente paga direto pra você. O app não fica com nada.</p></div>
        <div class="campo"><span class="pergunta">Leva até o cliente na areia?</span>
          ${escolha("entrega", [["nao", "Não"], ["sim", "Sim, levo"]], r.entrega)}</div>
        <button class="botao verde" data-acao="salvar-perfil">${primeira ? "Continuar →" : "💾 Salvar"}</button>
      </div>
      ${primeira ? "" : `<button class="link-botao" data-acao="sair">Sair desta conta</button>`}`;
  }
  function lerRascunhoPerfil() {
    if (!$("p-nome") || !E.rascunho) return;
    Object.assign(E.rascunho, {
      nome: $("p-nome").value, descricao: $("p-desc").value, whatsapp: $("p-whats").value, pix: $("p-pix").value,
      tipo: valorEscolha("tipo") || E.rascunho.tipo, entrega: valorEscolha("entrega") || E.rascunho.entrega,
    });
  }
  async function salvarPerfil() {
    lerRascunhoPerfil();
    const r = E.rascunho;
    const nome = r.nome.trim();
    if (nome.length < 2) return U.avisar("Coloque o nome da banca");
    const whatsapp = r.whatsapp.trim() ? U.whatsDigitos(r.whatsapp) : null;
    if (r.whatsapp.trim() && !whatsapp) return U.avisar("Confira o WhatsApp, com DDD");
    await tentar(async () => {
      const campos = { id: E.eu.id, nome, tipo: r.tipo, descricao: r.descricao.trim() || null, whatsapp,
        pix_chave: r.pix.trim() || null, faz_entrega: r.entrega === "sim" };
      if (E.fotoPara === "perfil" && E.fotoNova) campos.foto_url = await enviarFoto(E.fotoNova.blob, "perfil");
      const primeira = !E.perfil;
      const { data, error } = await sb.from("vendedores").upsert(campos).select().single();
      if (error) throw error;
      E.perfil = data; E.rascunho = null; limparFoto();
      if (primeira) { E.editando = "novo"; ir("produtos"); U.avisar("Pronto! Agora cadastre seus produtos"); }
      else { mostrar(); U.avisar("Salvo"); }
    });
  }

  // =====================================================================
  // INÍCIO
  // =====================================================================
  function telaInicio() {
    const p = E.perfil;
    const disponiveis = E.produtos.filter(x => x.disponivel).length;
    const pendencias = [
      [!!p.foto_url, "Foto da banca", "perfil"],
      [E.produtos.length > 0, "Pelo menos 1 produto", "produtos"],
      [E.produtos.some(x => x.foto_url), "Foto de um produto", "produtos"],
      [!!p.whatsapp, "WhatsApp", "perfil"],
      [!!p.pix_chave, "Chave Pix", "perfil"],
    ];
    const faltam = pendencias.filter(x => !x[0]).length;
    const aberto = p.aberto && Date.now() - new Date(p.atualizado_em) < 12 * 3600e3;
    return `
      <h1>Olá, ${esc(p.nome)}!</h1>
      <div class="cartao status ${aberto ? "aberto" : ""}">
        <div class="grande-emoji">${aberto ? "🟢" : "⚪"}</div>
        <div class="titulo">${aberto ? "Você está aberto" : "Você está fechado"}</div>
        <p class="suave">${aberto
          ? `Os clientes veem sua vitrine e sua posição. ${p.tipo === "ambulante" ? "Com o app aberto, sua posição acompanha você." : ""}`
          : "Ao abrir, sua banca aparece no mapa para os clientes."}</p>
        ${aberto
          ? `<div class="botoes-lado"><button class="botao secundario pequeno" data-acao="posicao">📍 Atualizar posição</button>
             <button class="botao perigo pequeno" data-acao="fechar">⚪ Fechar</button></div>
             <p class="nota">Posição enviada ${U.haQuanto(p.atualizado_em)}. Se esquecer aberto, fecha sozinho em 12 h.</p>`
          : `<button class="botao verde" data-acao="abrir" ${E.produtos.length ? "" : "disabled"}>🟢 Abrir agora</button>
             ${E.produtos.length ? `<p class="nota">Abra quando estiver na praia: o app usa sua localização deste momento.</p>` : `<p class="nota">Cadastre pelo menos 1 produto para abrir.</p>`}`}
      </div>
      ${faltam ? `<div class="cartao checklist"><div class="titulo-cartao"><span class="emoji">✅</span>Complete sua vitrine (${pendencias.length - faltam} de ${pendencias.length})</div>
        ${pendencias.map(([feito, texto, tela]) => `<div class="item ${feito ? "feito" : ""}"><span class="marca">${feito ? "✅" : "⬜"}</span><span class="texto">${texto}</span>
          ${feito ? "" : `<button data-acao="ir" data-tela="${tela}">Fazer</button>`}</div>`).join("")}</div>` : ""}
      <div class="cartao"><div class="titulo-cartao"><span class="emoji">🛍️</span>Sua vitrine</div>
        <div class="linha"><span>Produtos</span><b>${E.produtos.length}</b></div>
        <div class="linha"><span>Disponíveis agora</span><b>${disponiveis}</b></div>
        <a class="botao secundario pequeno" href="${linkVitrine()}" target="_blank" rel="noopener">👀 Ver como o cliente vê</a>
        <button class="botao whats pequeno" data-acao="compartilhar">📤 Mandar minha vitrine</button></div>
      <div class="cartao"><div class="titulo-cartao"><span class="emoji">🧾</span>Pedidos pelo app</div>
        <p class="suave" style="margin:0">Em breve: o cliente pede pela vitrine e você recebe aqui, com aviso. Por enquanto, os pedidos chegam pelo seu WhatsApp.</p></div>`;
  }
  async function abrir() {
    await tentar(async () => {
      U.avisar("Pegando sua localização…");
      const pos = await U.posicao();
      await mudarPerfil({ aberto: true, lat: pos.lat, lon: pos.lon });
      mostrar(); seguirPosicao();
    }, "Aberto! Os clientes já veem você");
  }

  // Ambulante: com o app aberto, a posição acompanha (a cada minuto, se andou mais de 25 m).
  // Banca: renova a cada 30 min para não sumir do mapa.
  let relogio = null, ultimoEnvio = 0;
  function seguirPosicao() {
    clearInterval(relogio);
    if (!E.perfil || !E.perfil.aberto) return;
    relogio = setInterval(async () => {
      if (document.hidden || !E.perfil.aberto) return;
      const p = E.perfil, agora = Date.now();
      try {
        if (p.tipo === "ambulante") {
          const pos = await U.posicao(false);
          const andou = U.distanciaM(pos, { lat: p.lat, lon: p.lon });
          if (andou > 25 || agora - ultimoEnvio > 10 * 60e3) { await mudarPerfil({ lat: pos.lat, lon: pos.lon }); ultimoEnvio = agora; }
        } else if (agora - new Date(p.atualizado_em) > 30 * 60e3) {
          await mudarPerfil({ aberto: true });
        }
        if (E.tela === "inicio") mostrar({ topo: false });
      } catch (e) { /* sem GPS ou internet agora: tenta no próximo minuto */ }
    }, 60e3);
  }

  // =====================================================================
  // PRODUTOS
  // =====================================================================
  function telaProdutos() {
    if (E.editando) return telaProduto();
    return `
      <h1>Meus produtos</h1>
      <button class="botao verde" data-acao="novo-produto">➕ Adicionar produto</button>
      ${E.produtos.length ? `<div class="cartao" style="margin-top:14px">
        ${E.produtos.map(x => `
          <div class="produto ${x.disponivel ? "" : "acabou"}">
            <div class="mini" style="${x.foto_url ? `background-image:url('${esc(x.foto_url)}')` : ""}">${x.foto_url ? "" : U.CATEGORIAS[x.categoria][0]}</div>
            <div class="info"><div class="nome-produto">${esc(x.nome)}</div><div class="preco">${U.reais(x.preco_centavos)}</div></div>
            <div class="lado">
              <button class="chave ${x.disponivel ? "tem" : "acabou"}" data-acao="alternar" data-id="${x.id}" aria-label="${x.disponivel ? "Marcar que acabou" : "Marcar que tem"}">${x.disponivel ? "✓ Tem" : "✗ Acabou"}</button>
              <button class="botao-icone" data-acao="editar-produto" data-id="${x.id}" aria-label="Editar ${esc(x.nome)}">✏️</button>
            </div>
          </div>`).join("")}
        <p class="nota">Acabou algum? Toque em <b>✓ Tem</b> para mostrar que acabou. Toque de novo quando chegar mais.</p>
      </div>` : `<p class="nota" style="text-align:center;margin-top:20px">Nenhum produto ainda. Toque em Adicionar.</p>`}`;
  }
  function telaProduto() {
    const x = E.editando === "novo" ? null : E.produtos.find(p => p.id === E.editando);
    const r = E.rascunho || (E.rascunho = { nome: x ? x.nome : "", preco: x ? U.precoTexto(x.preco_centavos) : "", categoria: x ? x.categoria : "bebida" });
    const foto = E.fotoPara === "produto" && E.fotoNova ? E.fotoNova.url : x && x.foto_url;
    return `
      <button class="link-botao voltar-link" data-acao="voltar-produtos">← Voltar</button>
      <h1>${x ? "Editar produto" : "Novo produto"}</h1>
      <div class="cartao">
        <button type="button" class="foto-quadro ${foto ? "tem" : ""}" data-acao="escolher-foto" data-para="produto" style="${foto ? `background-image:url('${esc(foto)}')` : ""}">
          ${foto ? "" : `<span class="chamada"><span class="emoji">📷</span>Foto do produto<br><span class="suave" style="font-weight:500">(ajuda muito a vender)</span></span>`}</button>
        ${foto ? `<button class="link-botao" data-acao="escolher-foto" data-para="produto">Trocar foto</button>` : ""}
        <div class="campo" style="margin-top:14px"><span class="pergunta">Tipo</span>
          <div class="categorias" data-grupo-cat>${Object.entries(U.CATEGORIAS).map(([k, [e, t]]) =>
            `<button type="button" data-categoria="${k}" class="${r.categoria === k ? "marcado" : ""}"><span class="emoji">${e}</span>${t}</button>`).join("")}</div></div>
        <div class="campo"><label for="x-nome">Nome</label>
          <input id="x-nome" class="entrada" maxlength="50" placeholder="Ex.: Milho cozido" value="${esc(r.nome)}"></div>
        ${x ? "" : `<div class="sugestoes">${SUGESTOES[r.categoria].map(s => `<button type="button" data-sugestao="${esc(s)}">${esc(s)}</button>`).join("")}</div>`}
        <div class="campo"><label for="x-preco">Preço</label>
          <div class="preco-campo"><span>R$</span><input id="x-preco" class="entrada" inputmode="decimal" placeholder="0,00" value="${esc(r.preco)}"></div></div>
        <button class="botao verde" data-acao="salvar-produto">💾 Salvar produto</button>
        ${x ? `<button class="botao perigo pequeno" data-acao="apagar-produto">🗑️ Apagar produto</button>` : ""}
      </div>`;
  }
  function lerRascunhoProduto() {
    if (!$("x-nome") || !E.rascunho) return;
    E.rascunho.nome = $("x-nome").value;
    E.rascunho.preco = $("x-preco").value;
  }
  async function salvarProduto() {
    lerRascunhoProduto();
    const r = E.rascunho;
    const nome = r.nome.trim(), preco = U.lerPreco(r.preco);
    if (nome.length < 2) return U.avisar("Coloque o nome do produto");
    if (preco == null || preco <= 0) return U.avisar("Coloque o preço");
    await tentar(async () => {
      const campos = { nome, preco_centavos: preco, categoria: r.categoria };
      if (E.fotoPara === "produto" && E.fotoNova) campos.foto_url = await enviarFoto(E.fotoNova.blob, "produto");
      if (E.editando === "novo") {
        campos.ordem = E.produtos.length;
        const { data, error } = await sb.from("produtos").insert(campos).select().single();
        if (error) throw error;
        E.produtos.push(data);
      } else {
        const { data, error } = await sb.from("produtos").update(campos).eq("id", E.editando).select().single();
        if (error) throw error;
        E.produtos = E.produtos.map(p => (p.id === data.id ? data : p));
      }
      E.editando = null; E.rascunho = null; limparFoto();
      mostrar();
    }, "Produto salvo");
  }

  // ---------- foto ----------
  function limparFoto() { if (E.fotoNova) URL.revokeObjectURL(E.fotoNova.url); E.fotoNova = null; E.fotoPara = null; }
  $("arquivo-foto").addEventListener("change", async e => {
    const arq = e.target.files[0];
    e.target.value = "";
    if (!arq) return;
    try {
      const blob = await U.comprimirFoto(arq);
      limparFoto();
      E.fotoPara = E.fotoPedida;
      E.fotoNova = { blob, url: URL.createObjectURL(blob) };
      mostrar({ topo: false });
    } catch (err) { U.avisar("Não consegui abrir essa foto"); }
  });

  // =====================================================================
  // NAVEGAÇÃO
  // =====================================================================
  const TELAS = { entrar: telaEntrar, perfil: telaPerfil, inicio: telaInicio, produtos: telaProdutos };
  function mostrar({ topo = true } = {}) {
    if (E.tela === "carregando") { conteudo.innerHTML = `<p class="suave">Carregando…</p>`; return; }
    if (E.tela === "sem-nuvem") {
      conteudo.innerHTML = `<h1>Quase pronto 🏗️</h1><div class="cartao"><p>A área do vendedor ainda está sendo ligada. Volte em breve.</p></div>`;
      return;
    }
    conteudo.innerHTML = `<div class="entrar">${TELAS[E.tela]()}</div>`;
    const logado = E.tela !== "entrar" && E.perfil;
    $("abas").hidden = !logado;
    document.querySelectorAll(".abas button").forEach(b => b.toggleAttribute("aria-current", b.dataset.tela === E.tela));
    document.querySelectorAll(".abas button[aria-current]").forEach(b => b.setAttribute("aria-current", "page"));
    if (topo) window.scrollTo(0, 0);
  }
  function ir(tela) {
    if (E.tela === "perfil") lerRascunhoPerfil();
    if (tela !== E.tela) { E.rascunho = null; limparFoto(); E.editando = tela === "produtos" ? E.editando : null; }
    E.tela = tela;
    mostrar();
  }

  const ACOES = {
    "pedir-codigo": () => {
      const email = $("email").value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return U.avisar("Confira o e-mail");
      E.email = email;
      tentar(async () => {
        const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (error) throw error;
        E.etapaLogin = "codigo"; mostrar();
        setTimeout(() => $("codigo") && $("codigo").focus(), 100);
      }, "Código enviado. Olhe seu e-mail");
    },
    verificar: () => {
      const token = $("codigo").value.replace(/\D/g, "");
      if (token.length < 6) return U.avisar("O código tem 6 números");
      tentar(async () => {
        const { data, error } = await sb.auth.verifyOtp({ email: E.email, token, type: "email" });
        if (error) throw error;
        E.eu = data.user;
        await carregar();
        E.tela = E.perfil ? "inicio" : "perfil";
        mostrar(); seguirPosicao();
      });
    },
    "outro-email": () => { E.etapaLogin = "email"; mostrar(); },
    sair: () => tentar(async () => {
      if (!confirm("Sair desta conta neste celular?")) return;
      await sb.auth.signOut();
      Object.assign(E, { eu: null, perfil: null, produtos: [], tela: "entrar", etapaLogin: "email" });
      mostrar();
    }),
    "salvar-perfil": salvarPerfil,
    "escolher-foto": b => { if (E.tela === "perfil") lerRascunhoPerfil(); if (E.editando) lerRascunhoProduto(); E.fotoPedida = b.dataset.para; $("arquivo-foto").click(); },
    ir: b => ir(b.dataset.tela),
    abrir,
    fechar: () => tentar(async () => { await mudarPerfil({ aberto: false }); clearInterval(relogio); mostrar(); }, "Fechado. Você saiu do mapa"),
    posicao: () => tentar(async () => { const pos = await U.posicao(); await mudarPerfil({ lat: pos.lat, lon: pos.lon }); mostrar({ topo: false }); }, "Posição atualizada"),
    compartilhar: async () => {
      const texto = `Olha minha vitrine no Na Areia: ${linkVitrine()}`;
      if (navigator.share) { navigator.share({ text: texto }).catch(() => {}); } else window.open(U.linkWhats("", texto), "_blank");
    },
    "novo-produto": () => { E.editando = "novo"; E.rascunho = null; limparFoto(); mostrar(); },
    "editar-produto": b => { E.editando = b.dataset.id; E.rascunho = null; limparFoto(); mostrar(); },
    "voltar-produtos": () => { E.editando = null; E.rascunho = null; limparFoto(); mostrar(); },
    "salvar-produto": salvarProduto,
    "apagar-produto": () => {
      const x = E.produtos.find(p => p.id === E.editando);
      if (!x || !confirm(`Apagar ${x.nome}?`)) return;
      tentar(async () => {
        const { error } = await sb.from("produtos").delete().eq("id", x.id);
        if (error) throw error;
        E.produtos = E.produtos.filter(p => p.id !== x.id);
        E.editando = null; E.rascunho = null; mostrar();
      }, "Produto apagado");
    },
    alternar: b => tentar(async () => {
      const x = E.produtos.find(p => p.id === b.dataset.id);
      const { data, error } = await sb.from("produtos").update({ disponivel: !x.disponivel }).eq("id", x.id).select().single();
      if (error) throw error;
      E.produtos = E.produtos.map(p => (p.id === data.id ? data : p));
      mostrar({ topo: false });
    }),
  };

  document.addEventListener("click", e => {
    const aba = e.target.closest(".abas [data-tela]");
    if (aba) return ir(aba.dataset.tela);
    const op = e.target.closest(".escolha [data-valor]");
    if (op) { op.parentElement.querySelectorAll("button").forEach(b => b.classList.toggle("marcado", b === op)); return; }
    const cat = e.target.closest("[data-categoria]");
    if (cat) { lerRascunhoProduto(); E.rascunho.categoria = cat.dataset.categoria; mostrar({ topo: false }); return; }
    const sug = e.target.closest("[data-sugestao]");
    if (sug) { $("x-nome").value = sug.dataset.sugestao; $("x-preco").focus(); return; }
    const a = e.target.closest("[data-acao]");
    if (a && ACOES[a.dataset.acao]) { e.preventDefault(); ACOES[a.dataset.acao](a); }
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    if (e.target.id === "email") ACOES["pedir-codigo"]();
    if (e.target.id === "codigo") ACOES.verificar();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && E.perfil && E.perfil.aberto) seguirPosicao(); });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});

  // ---------- começo ----------
  (async () => {
    if (!sb) { E.tela = "sem-nuvem"; return mostrar(); }
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) { E.tela = "entrar"; return mostrar(); }
      E.eu = data.session.user;
      await carregar();
      E.tela = E.perfil ? "inicio" : "perfil";
      if (E.perfil && E.perfil.aberto) { await mudarPerfil({ aberto: true }).catch(() => {}); seguirPosicao(); }
    } catch (e) { E.tela = "entrar"; U.avisar(mensagemErro(e)); }
    mostrar();
  })();
})();
