ARG OHIF_VERSION=v3.12.0

FROM node:18-alpine AS builder
RUN apk add --no-cache git python3 make g++ py3-setuptools
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV PUBLIC_URL="/ohif/"
WORKDIR /app

ARG OHIF_VERSION
RUN git clone --depth 1 --branch ${OHIF_VERSION} \
    https://github.com/OHIF/Viewers.git /app/Viewers

COPY OHIF/config/default.js /app/Viewers/platform/app/public/config/default.js

WORKDIR /app/Viewers
RUN yarn install --frozen-lockfile --network-timeout 600000
RUN yarn run build

FROM nginx:1.25-alpine
COPY --from=builder /app/Viewers/platform/app/dist /usr/share/nginx/html
COPY OHIF/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
