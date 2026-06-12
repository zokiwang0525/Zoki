FROM node:20-slim
WORKDIR /app

# 先裝相依套件(利用快取)
COPY package*.json ./
RUN npm install --omit=dev

# 複製伺服器程式(大型素材已用 .dockerignore 排除,因為前端在 Vercel)
COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
