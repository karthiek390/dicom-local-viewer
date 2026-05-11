FROM node:20-alpine AS frontend-builder

WORKDIR /opt/web
COPY web/package.json ./
COPY web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM nginx:1.25-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /opt/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
