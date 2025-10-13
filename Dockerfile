# =========================
# 1. Build da aplicação
# =========================
FROM node:20-alpine AS build

WORKDIR /app

# Instala dependências do Angular/Ionic
COPY package*.json ./
RUN npm install -g @angular/cli @ionic/cli && npm install

# Copia o código da aplicação
COPY . .

# Gera a versão de produção do Angular
RUN ionic build --configuration production

# =========================
# 2. Servidor Web (Nginx)
# =========================
FROM nginx:alpine

# Remove a config default e copia a customizada
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d

# Copia os arquivos buildados do Angular
COPY --from=build /app/www/ /usr/share/nginx/html

# 1. Copia o script
COPY entrypoint.sh /entrypoint.sh

# 2. Instala dos2unix, converte o arquivo e remove o utilitário
RUN apk add --no-cache dos2unix && \
    dos2unix /entrypoint.sh && \
    apk del dos2unix

# 3. Dá a permissão de execução
RUN chmod +x /entrypoint.sh

# Define o script como entrypoint do container
ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]