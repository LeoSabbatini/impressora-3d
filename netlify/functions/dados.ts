import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { dados } from "../../db/schema.js";

// Coleções permitidas: configurações/gastos, tipos e filamentos, produtos (itens), impressora e pedidos.
const CHAVES = ["config3d", "tipos3d", "filamentos3d", "produtos3d", "impressora3d", "pedidos3d"];

export default async (req: Request, context: Context) => {
  const chave = context.params.chave;

  if (req.method === "GET" && !chave) {
    const linhas = await db.select().from(dados);
    const resultado: Record<string, unknown> = {};
    for (const l of linhas) resultado[l.chave] = l.valor;
    return Response.json(resultado, { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "PUT" && chave) {
    if (!CHAVES.includes(chave)) return new Response("Chave inválida", { status: 400 });
    let valor: unknown;
    try {
      valor = await req.json();
    } catch {
      return new Response("JSON inválido", { status: 400 });
    }
    if (valor === null || typeof valor !== "object") return new Response("Valor inválido", { status: 400 });
    await db
      .insert(dados)
      .values({ chave, valor, atualizadoEm: new Date() })
      .onConflictDoUpdate({ target: dados.chave, set: { valor, atualizadoEm: new Date() } });
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/dados", "/api/dados/:chave"],
};
