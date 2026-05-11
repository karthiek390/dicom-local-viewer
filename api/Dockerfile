FROM node:20-alpine

WORKDIR /opt/app

COPY api/package.json ./
COPY api/package-lock.json ./
RUN npm ci --omit=dev

COPY api/src ./src

EXPOSE 3030

CMD ["npm", "start"]
