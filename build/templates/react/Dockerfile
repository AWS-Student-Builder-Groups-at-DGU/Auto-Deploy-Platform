# React 정적 빌드 → nginx 8080 서빙 (CRA build/ 와 Vite dist/ 모두 대응)
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci 2>/dev/null || npm install

COPY . .
RUN npm run build && \
    (cp -r dist /output 2>/dev/null || cp -r build /output)

FROM nginx:alpine
COPY --from=builder /output /usr/share/nginx/html
RUN sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
