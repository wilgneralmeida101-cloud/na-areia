// Ligação com o Supabase. A chave "anon/publishable" é pública por natureza:
// quem protege os dados são as regras em supabase/schema.sql.
// Nunca coloque aqui a chave "service_role"/"secret" nem a senha do banco.
window.NUVEM = {
  url: "https://bewgkinupovfosvaztxz.supabase.co",
  chave: "sb_publishable_m9_7BUz54pRMoYFzxy7Rcg_ctOjghdA",
  // Enquanto não há operação real: mostra a faixa de homologação e (no app do cliente) a simulação de Fortaleza.
  homologacao: true,
};
