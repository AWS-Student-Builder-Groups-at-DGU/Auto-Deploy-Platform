# Node.js 백엔드 (Express 등)
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --production

COPY . .

EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]
