FROM node:20-slim

WORKDIR /app

# Instala openssl e ferramentas essenciais para compilação
RUN apt-get update -y && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copia arquivos de definição de dependências
COPY package.json package-lock.json* ./

# Instala dependências em produção
RUN npm ci --legacy-peer-deps

# Copia os arquivos de código
COPY . .

# Executa o generate do Prisma
RUN npx prisma generate

# Executa o build da aplicação Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Expõe a porta que a aplicação roda
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Aplica somente migrations versionadas. Seed nunca roda automaticamente em produção.
# Em instalações Compose, DATABASE_URL pode ser derivada das variáveis do Postgres.
CMD ["sh", "-c", "if [ -z \"$DATABASE_URL\" ]; then export DATABASE_URL=\"$(node scripts/resolve-database-url.js)\"; fi; npx prisma migrate deploy && npm run start"]
