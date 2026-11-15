// Funções comuns do Na Areia (cliente e vendedor).
(function () {
  const U = {};
  U.$ = id => document.getElementById(id);
  U.esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.reais = c => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  U.precoTexto = c => (c / 100).toFixed(2).replace(".", ",");
  U.lerPreco = t => { const n = parseFloat(String(t).replace(/[^\d,.]/g, "").replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) : null; };
  U.ehIphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  U.CATEGORIAS = { bebida: ["🥤", "Bebidas"], lanche: ["🌽", "Lanches"], doce: ["🍦", "Doces"], petisco: ["🍤", "Petiscos"], outro: ["🛍️", "Outros"] };

  // Número de WhatsApp: guarda só dígitos com 55 na frente.
  U.whatsDigitos = t => {
    let d = String(t || "").replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) d = "55" + d;
    return d.length >= 12 && d.length <= 13 ? d : null;
  };
  U.whatsMostrar = d => {
    const m = String(d || "").replace(/^55/, "").match(/^(\d{2})(\d{4,5})(\d{4})$/);
    return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d || "";
  };
  U.linkWhats = (numero, texto) => `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

  U.distanciaM = (a, b) => {
    const R = 6371000, r = x => x * Math.PI / 180;
    const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  U.textoDistancia = m => {
    const min = Math.max(1, Math.round(m / 80));
    if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m · ${min} min a pé`;
    return `${(m / 1000).toFixed(1).replace(".", ",")} km${m < 5000 ? ` · ${min} min a pé` : ""}`;
  };
  U.haQuanto = iso => {
    const min = Math.round((Date.now() - new Date(iso)) / 60000);
    return min < 2 ? "agora" : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
  };
  // Rota a pé: Apple Maps no iPhone, Google Maps no Android.
  U.linkRota = (lat, lon, apple = U.ehIphone) => apple
    ? `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;

  U.avisar = texto => {
    document.querySelectorAll(".aviso-toast").forEach(t => t.remove());
    const t = document.createElement("div");
    t.className = "aviso-toast"; t.setAttribute("role", "status"); t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  };
  U.copiar = async (texto, aviso = "Copiado") => {
    try { await navigator.clipboard.writeText(texto); U.avisar(aviso); }
    catch (e) { prompt("Copie:", texto); }
  };

  U.posicao = (alta = true) => new Promise((ok, falha) => {
    if (!navigator.geolocation) return falha(new Error("sem GPS"));
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: Math.round(p.coords.latitude * 100000) / 100000, lon: Math.round(p.coords.longitude * 100000) / 100000 }),
      e => falha(e), { timeout: 15000, enableHighAccuracy: alta, maximumAge: 30000 });
  });

  // Foto do celular → JPEG leve (até ~900 px), para subir rápido na praia.
  U.comprimirFoto = (arquivo, lado = 900) => new Promise((ok, falha) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? ok(b) : falha(new Error("foto"))), "image/jpeg", 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("foto")); };
    img.src = url;
  });

  U.nuvem = chaveSessao => {
    if (!window.NUVEM || !NUVEM.url || !window.supabase) return null;
    return window.supabase.createClient(NUVEM.url, NUVEM.chave, { auth: { persistSession: true, storageKey: chaveSessao, autoRefreshToken: true } });
  };

  window.U = U;
})();
