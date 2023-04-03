FROM node:19.8.1-alpine3.16 AS builder

LABEL maintainer="https://github.com/Dosbodoke"

WORKDIR /app/server

COPY package.json ./
COPY yarn.lock ./

RUN yarn install && yarn cache clean

EXPOSE 3000

COPY . .

ENTRYPOINT ["yarn", "run"]

CMD ["dev"]
