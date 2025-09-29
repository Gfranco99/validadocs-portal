# Usar Node.js como base
FROM node:24-alpine

# Definir diretório de trabalho
WORKDIR /usr/src/app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm install --only=production

# Copiar código da aplicação
COPY . .

# Expor porta (ajuste se necessário)
EXPOSE 3000

# Rodar o proxy
CMD ["node", "app.js"]
