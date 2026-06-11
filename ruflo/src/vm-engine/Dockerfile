FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 4000
CMD ["node", "--loader", "ts-node/esm", "index.ts"]
