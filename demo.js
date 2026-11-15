// Na Areia — AMBIENTE DE HOMOLOGAÇÃO (simulação).
// Simula uma operação em Fortaleza/CE: bancas e ambulantes fictícios e um motor de pedidos rodando.
// Não grava nada no banco de dados e não manda nada para ninguém.
// Enquanto não há operação real, fica LIGADO por padrão. Para desligar: ?sair-demo (ou HOMOLOGACAO_PADRAO = false).
(function () {
  const HOMOLOGACAO_PADRAO = !!(window.NUVEM && NUVEM.homologacao);
  const params = new URLSearchParams(location.search);
  if (params.has("demo")) sessionStorage.setItem("na-areia-demo", "1");
  if (params.has("sair-demo")) sessionStorage.setItem("na-areia-demo", "0");
  const escolha = sessionStorage.getItem("na-areia-demo");
  const ativo = escolha ? escolha === "1" : HOMOLOGACAO_PADRAO;
  if (!ativo) { window.Demo = { ativo: false }; return; }

  // Número pseudoaleatório fixo: a demonstração começa sempre igual.
  let semente = 20261115;
  const sorte = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
  const escolher = xs => xs[Math.floor(sorte() * xs.length)];

  // Faixa de areia de cada praia (pontos aproximados, de uma ponta à outra).
  const PRAIAS = {
    // conferido no mapa: pontos sobre a faixa de areia
    "Praia do Futuro": [[-3.7335, -38.4544], [-3.7420, -38.4492], [-3.7520, -38.4446], [-3.7630, -38.4406], [-3.7695, -38.4388]],
    "Iracema e Meireles": [[-3.7194, -38.5128], [-3.7197, -38.5110], [-3.7206, -38.5082], [-3.7235, -38.5006], [-3.7238, -38.4963], [-3.7246, -38.4930]],
    "Mucuripe": [[-3.7246, -38.4930], [-3.7250, -38.4905], [-3.7252, -38.4890]],
  };
  // Ponto na praia: t de 0 a 1 ao longo da faixa, recuado um pouco para o lado do mar (areia).
  function pontoNaPraia(praia, t) {
    const pts = PRAIAS[praia], n = pts.length - 1;
    const x = Math.max(0, Math.min(0.9999, t)) * n, i = Math.floor(x), f = x - i;
    return { lat: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, lon: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f };
  }

  // Foto ilustrativa: fundo colorido com o desenho do produto.
  const CORES = ["#ffd54a,#f2a900", "#8fd3ff,#1e88e5", "#a5e3a1,#2e9b3a", "#ffb3c1,#e5487a", "#ffcc99,#f07c1c", "#d7c4ff,#7b52e0"];
  const fotoDe = (emoji, i) => {
    const [a, b] = CORES[i % CORES.length].split(",");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><text x="200" y="195" font-size="150" text-anchor="middle">${emoji}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };

  // Cardápios típicos da orla de Fortaleza (preços em centavos).
  const CARDAPIO = {
    coco: [["Água de coco", 700, "bebida", "🥥"], ["Água mineral", 400, "bebida", "💧"]],
    milho: [["Milho cozido", 700, "lanche", "🌽"], ["Milho assado na manteiga", 800, "lanche", "🌽"]],
    queijo: [["Queijo coalho na brasa", 1000, "lanche", "🧀"], ["Queijo coalho com melaço", 1200, "lanche", "🧀"]],
    picole: [["Picolé de frutas", 500, "doce", "🍦"], ["Picolé de tapioca", 600, "doce", "🍦"], ["Sorvete no copo", 900, "doce", "🍨"]],
    acai: [["Açaí 300 ml", 1500, "doce", "🍇"], ["Açaí 500 ml", 2200, "doce", "🍇"]],
    cocada: [["Cocada branca", 400, "doce", "🥥"], ["Cocada de leite", 500, "doce", "🥥"], ["Doce de caju", 500, "doce", "🍯"]],
    bebidas: [["Cerveja lata", 800, "bebida", "🍺"], ["Refrigerante lata", 600, "bebida", "🥤"], ["Caipirinha", 1800, "bebida", "🍹"]],
    camarao: [["Camarão no espeto", 2000, "petisco", "🍤"], ["Castanha de caju", 1000, "petisco", "🥜"]],
    caranguejo: [["Caranguejo (unidade)", 1500, "petisco", "🦀"], ["Casquinha de caranguejo", 1200, "petisco", "🦀"]],
    barraca: [["Peixe frito", 4500, "petisco", "🐟"], ["Batata frita", 2500, "petisco", "🍟"], ["Caipirinha", 2000, "bebida", "🍹"], ["Água de coco", 800, "bebida", "🥥"]],
    tapioca: [["Tapioca de queijo", 1200, "lanche", "🫓"], ["Tapioca de carne de sol", 1600, "lanche", "🫓"]],
    protetor: [["Protetor solar FPS 50", 4000, "outro", "🧴"], ["Chapéu de palha", 3000, "outro", "👒"], ["Canga", 3500, "outro", "🏖️"]],
  };
  const VENDEDORES = [
    ["Coco Gelado do Tião", "ambulante", ["coco"], "Praia do Futuro"],
    ["Milho do Seu Zé", "ambulante", ["milho"], "Praia do Futuro"],
    ["Queijo Coalho do Neném", "ambulante", ["queijo"], "Praia do Futuro"],
    ["Picolé da Dona Fátima", "ambulante", ["picole"], "Praia do Futuro"],
    ["Açaí do Léo", "ambulante", ["acai"], "Praia do Futuro"],
    ["Cocada da Vó Zefa", "ambulante", ["cocada"], "Praia do Futuro"],
    ["Camarão do Chico", "ambulante", ["camarao"], "Praia do Futuro"],
    ["Caranguejo da Socorro", "ambulante", ["caranguejo"], "Praia do Futuro"],
    ["Barraca Sol & Mar", "banca", ["barraca"], "Praia do Futuro"],
    ["Barraca Ondas Verdes", "banca", ["barraca", "bebidas"], "Praia do Futuro"],
    ["Barraca Areia Branca", "banca", ["barraca"], "Praia do Futuro"],
    ["Tapioca da Lúcia", "banca", ["tapioca", "coco"], "Praia do Futuro"],
    ["Protetor & Cia do Wellington", "ambulante", ["protetor"], "Praia do Futuro"],
    ["Bebidas do Bigode", "ambulante", ["bebidas"], "Praia do Futuro"],
    ["Coco da Iracema", "ambulante", ["coco"], "Iracema e Meireles"],
    ["Milho Quentinho do Raimundo", "ambulante", ["milho", "queijo"], "Iracema e Meireles"],
    ["Picolé do Francisco", "ambulante", ["picole"], "Iracema e Meireles"],
    ["Açaí Beira-Mar da Paula", "banca", ["acai", "picole"], "Iracema e Meireles"],
    ["Tapioca da Ceiça", "banca", ["tapioca"], "Iracema e Meireles"],
    ["Caipirinha do Marcão", "ambulante", ["bebidas"], "Iracema e Meireles"],
    ["Cocada do Seu Antônio", "ambulante", ["cocada"], "Iracema e Meireles"],
    ["Castanha do Galego", "ambulante", ["camarao"], "Mucuripe"],
    ["Coco do Mucuripe", "banca", ["coco", "bebidas"], "Mucuripe"],
    ["Peixe Frito da Dona Rita", "banca", ["barraca"], "Mucuripe"],
    ["Queijo do Juninho", "ambulante", ["queijo", "milho"], "Mucuripe"],
  ];
  const DESCRICOES = { ambulante: "Passa pela areia. Peça que ele vai até você.", banca: "Mesa, cadeira e guarda-sol na areia." };

  const agoraIso = () => new Date().toISOString();
  const lista = VENDEDORES.map(([nome, tipo, cardapios, praia], i) => {
    const t = sorte();
    const produtos = cardapios.flatMap(c => CARDAPIO[c]).map(([pn, preco, categoria, emoji], j) => ({
      id: `d1000000-0000-4000-8000-${String(i * 100 + j).padStart(12, "0")}`,
      nome: pn, preco_centavos: preco, categoria, foto_url: fotoDe(emoji, i + j), disponivel: sorte() > 0.12, ordem: j,
    }));
    return {
      id: `d0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      nome, tipo, descricao: DESCRICOES[tipo], foto_url: fotoDe(produtos[0] ? CARDAPIO[cardapios[0]][0][3] : "🏖️", i),
      whatsapp: "5585900000000", pix_chave: "demonstracao@naareia.app", faz_entrega: tipo === "ambulante" || sorte() > 0.5,
      aberto: sorte() > 0.15, praia, t, sentido: sorte() > 0.5 ? 1 : -1, atualizado_em: agoraIso(), produtos,
      ...pontoNaPraia(praia, t),
    };
  });

  // A cada passo: ambulantes andam pela areia, produtos acabam e voltam, bancas abrem e fecham.
  // Tempo acelerado: cada passo de 3 s vale uns 30 s de praia.
  let passo = function () {
    lista.forEach(v => {
      if (v.tipo === "ambulante" && v.aberto && !v.indoAte) {
        const tamanho = { "Praia do Futuro": 4100, "Iracema e Meireles": 2000, "Mucuripe": 450 }[v.praia];
        v.t += v.sentido * (35 / tamanho) * (0.6 + sorte() * 0.8);
        if (v.t > 1 || v.t < 0) { v.sentido *= -1; v.t = Math.max(0, Math.min(1, v.t)); }
        Object.assign(v, pontoNaPraia(v.praia, v.t));
        v.atualizado_em = agoraIso();
      }
      v.produtos.forEach(p => { if (sorte() < (p.disponivel ? 0.004 : 0.03)) p.disponivel = !p.disponivel; });
      if (!v.indoAte && sorte() < (v.aberto ? 0.002 : 0.02)) v.aberto = !v.aberto;
    });
  };
  setInterval(() => passo(), 3000);

  const copia = v => JSON.parse(JSON.stringify(v));
  const visiveis = () => lista.filter(v => v.aberto).map(copia);

  // ---------- pedido simulado (prévia da fase 2) ----------
  let pedido = null;
  function fazerPedido(vendedorId, itens, cliente) {
    const v = lista.find(x => x.id === vendedorId);
    pedido = { codigo: String(1000 + Math.floor(sorte() * 9000)), vendedorId, itens, cliente, status: "novo", criado: Date.now(), historico: [["novo", Date.now()]] };
    const muda = (status, depois) => setTimeout(() => {
      if (!pedido || pedido.status === "cancelado") return;
      pedido.status = status; pedido.historico.push([status, Date.now()]);
      if (status === "a_caminho" && v.tipo === "ambulante" && cliente.lat) v.indoAte = { lat: cliente.lat, lon: cliente.lon };
      if (status === "entregue") v.indoAte = null;
    }, depois);
    muda("aceito", 5000); muda("a_caminho", 11000); muda("entregue", 30000);
    return pedido;
  }
  // Ambulante a caminho: anda em direção ao cliente.
  setInterval(() => {
    lista.forEach(v => {
      if (!v.indoAte) return;
      v.lat += (v.indoAte.lat - v.lat) * 0.18; v.lon += (v.indoAte.lon - v.lon) * 0.18; v.atualizado_em = agoraIso();
    });
  }, 1000);

  // ---------- motor: clientes fictícios fazendo pedidos o tempo todo ----------
  const NOMES = ["Ana", "Bruno", "Carla", "Diego", "Érica", "Felipe", "Gabi", "Heitor", "Iara", "João", "Larissa", "Marcos",
    "Nathália", "Otávio", "Paula", "Rafael", "Sabrina", "Thiago", "Vanessa", "Wesley", "Yasmin", "Lucas", "Bia", "Pedro"];
  const LUGARES = ["guarda-sol azul", "barraca 12", "perto do posto salva-vidas", "cadeira amarela", "em frente à barraca 7", "perto das pedras"];
  const eventos = [];
  const resumo = { pedidos: 0, entregues: 0, faturamentoCentavos: 0, emAndamento: 0 };
  const registrar = (emoji, texto) => { eventos.unshift({ emoji, texto, em: Date.now() }); eventos.length = Math.min(eventos.length, 30); };
  // começa o dia com algum movimento já acontecido
  resumo.pedidos = 40 + Math.floor(sorte() * 30);
  resumo.entregues = resumo.pedidos - 3;
  resumo.faturamentoCentavos = resumo.pedidos * (1800 + Math.floor(sorte() * 900));
  function pedidoFicticio() {
    const abertos = lista.filter(v => v.aberto && v.produtos.some(p => p.disponivel));
    if (!abertos.length) return;
    const v = escolher(abertos), nome = escolher(NOMES);
    const disponiveis = v.produtos.filter(p => p.disponivel);
    const itens = [];
    const n = 1 + Math.floor(sorte() * Math.min(3, disponiveis.length));
    for (let i = 0; i < n; i++) {
      const p = disponiveis[i];
      itens.push({ nome: p.nome, qtd: 1 + Math.floor(sorte() * 3), preco_centavos: p.preco_centavos });
    }
    const total = itens.reduce((a, x) => a + x.qtd * x.preco_centavos, 0);
    resumo.pedidos++; resumo.emAndamento++;
    registrar("🧺", `${nome} pediu ${itens.map(x => `${x.qtd}× ${x.nome}`).join(", ")} · <b>${v.nome}</b>`);
    setTimeout(() => registrar("👍", `<b>${v.nome}</b> aceitou o pedido de ${nome}`), 4000 + sorte() * 4000);
    if (v.faz_entrega) setTimeout(() => registrar("🛵", `${v.nome} levando para ${nome} (${escolher(LUGARES)})`), 10000 + sorte() * 6000);
    setTimeout(() => {
      resumo.entregues++; resumo.emAndamento--; resumo.faturamentoCentavos += total;
      registrar("✅", `Entregue para ${nome} · ${(total / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
    }, 22000 + sorte() * 15000);
  }
  // abrir/fechar e "acabou" também viram notícias no movimento
  const passoOriginal = passo;
  passo = function () {
    const antes = lista.map(v => [v.aberto, v.produtos.map(p => p.disponivel)]);
    passoOriginal();
    lista.forEach((v, i) => {
      if (v.aberto !== antes[i][0]) registrar(v.aberto ? "🟢" : "⚪", `<b>${v.nome}</b> ${v.aberto ? "abriu" : "fechou"}`);
      v.produtos.forEach((p, j) => { if (antes[i][1][j] && !p.disponivel) registrar("🚫", `Acabou ${p.nome} · ${v.nome}`); });
    });
  };
  (function agendar() { setTimeout(() => { pedidoFicticio(); agendar(); }, 5000 + sorte() * 7000); })();
  setTimeout(pedidoFicticio, 1200);

  // Onde a pessoa "está" na simulação.
  const LUGARES_CLIENTE = {
    sonata: { nome: "Hotel Sonata de Iracema", lat: -3.72040, lon: -38.51227 },
    iracema: { nome: "Praia de Iracema", lat: -3.7203, lon: -38.5090 },
    meireles: { nome: "Praia do Meireles", lat: -3.7236, lon: -38.4995 },
    mucuripe: { nome: "Mucuripe", lat: -3.7249, lon: -38.4910 },
    futuro: { nome: "Praia do Futuro", lat: -3.7470, lon: -38.4466 },
  };
  if (params.get("local") && LUGARES_CLIENTE[params.get("local")]) sessionStorage.setItem("na-areia-lugar", params.get("local"));
  let lugar = LUGARES_CLIENTE[sessionStorage.getItem("na-areia-lugar")] ? sessionStorage.getItem("na-areia-lugar") : "sonata";
  // "simulado": a pessoa está no lugar escolhido; "real": usa o GPS do celular.
  let modoLocal = sessionStorage.getItem("na-areia-modo-local") === "real" ? "real" : "simulado";

  window.Demo = {
    lugares: LUGARES_CLIENTE,
    lugar: () => lugar,
    modoLocal: () => modoLocal,
    definirModoLocal: m => { modoLocal = m === "real" ? "real" : "simulado"; sessionStorage.setItem("na-areia-modo-local", modoLocal); },
    definirLugar: k => { if (LUGARES_CLIENTE[k]) { lugar = k; sessionStorage.setItem("na-areia-lugar", k); } },
    get centro() { const l = LUGARES_CLIENTE[lugar]; return { lat: l.lat, lon: l.lon }; },
    eventos: () => eventos.slice(),
    resumo: () => Object.assign({}, resumo, { abertos: lista.filter(v => v.aberto).length, ambulantesAndando: lista.filter(v => v.aberto && v.tipo === "ambulante").length }),
    ativo: true,
    vendedores: visiveis,
    um: id => { const v = lista.find(x => x.id === id && x.aberto); return v ? copia(v) : null; },
    fazerPedido,
    pedido: () => pedido && Object.assign({}, pedido, { vendedor: copia(lista.find(x => x.id === pedido.vendedorId)) }),
    cancelar: () => { if (pedido && pedido.status === "novo") { pedido.status = "cancelado"; pedido.historico.push(["cancelado", Date.now()]); } },
  };
})();
