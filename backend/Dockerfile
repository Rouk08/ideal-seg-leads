FROM node:20-alpine AS base
WORKDIR /app
# Alpine não traz OpenSSL por padrão — os engines do Prisma (schema/migration
# engine) precisam dele em tempo de build (generate) e em runtime (migrate
# deploy). Sem isso o container sobe e cai em loop, com um erro obscuro de
# "Could not parse schema engine response".
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
# node_modules vem do estágio "build", não "deps": é lá que "prisma generate"
# roda e escreve o client gerado dentro de node_modules/@prisma/client —
# copiar de "deps" traz só os pacotes instalados, sem o client gerado.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

EXPOSE 3333
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
