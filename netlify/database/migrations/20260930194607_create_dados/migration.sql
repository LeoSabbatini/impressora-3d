CREATE TABLE "dados" (
	"chave" text PRIMARY KEY,
	"valor" jsonb NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
