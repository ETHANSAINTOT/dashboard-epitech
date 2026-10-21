FROM node:latest

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 8080
CMD ["npm", "run", "dev"]
