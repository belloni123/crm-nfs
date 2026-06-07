FROM node:20-alpine

WORKDIR /app

# Instala ferramentas necessárias para compilar pacotes nativos se houver
RUN apk add --no-cache libc6-compat python3 make g++

# Copia arquivos de definição de dependências
COPY package.json package-lock.json* ./

# Instala dependências em produção
RUN npm install --legacy-peer-deps

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

# Comando para iniciar
CMD ["npm", "run", "start"]
