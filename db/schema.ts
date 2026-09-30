import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Cada linha guarda uma coleção do app (filamentos, produtos, pedidos, etc.) como JSON.
export const dados = pgTable("dados", {
  chave: text().primaryKey(),
  valor: jsonb().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});
