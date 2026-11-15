// Ligação com o Supabase. A chave "anon/publishable" é pública por natureza:
// quem protege os dados são as regras em supabase/schema.sql.
// Nunca coloque aqui a chave "service_role"/"secret" nem a senha do banco.
window.NUVEM = {
  url: "",   // ex.: https://xxxxxxxx.supabase.co
  chave: "", // chave anon / publishable
};
