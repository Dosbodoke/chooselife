# **CHOOSELIFE**

An open source API and a mobile client made for Highliners!

This repository is composed by two modules

`./mobile/`: A mobile app built with React Native (EXPO).

`./server/`: Type safed api built with tRPC and Prisma.

# Table of contents

- [CHOOSELIFE](#chooselife)
  - [Run Locally](#run-locally)
    - [Database](#database)
    - [Server](#server)
    - [Mobile](#mobile)

## Run Locally

Clone the project from [this repository](https://github.com/Dosbodoke/high-xp) and go to the project directory.

### Database

The database run in a Docker container (+pgadming for databas administration on the browser).

```bash
  docker-compose up --build
```

It requires some configuration, set you configs on `docker-compose.yml`

#### postgres

```
    ports:
      - "${db_port}:5432"
    environment
        POSTGRES_USER: ${db_user}
        POSTGRES_PASSWORD: ${db_password}
        POSTGRES_DB: ${db_name}
        POSTGRES_HOST: postgres
        DATABASE_PORT: 6500
        POSTGRES_HOSTNAME: 127.0.0.1
```

#### pgadmin

```
  ports:
    - "${PORT}:80"
  environment:
    PGADMIN_DEFAULT_EMAIL: ${EMAIL}
    PGADMIN_DEFAULT_PASSWORD: ${PASSWORD}
```

Tou can access the PgAdmin dashboard via browser on [http://localhost:${PORT}/]()

Use `${EMAIL}` and `${PASSWORD}` to login.

---

### Server

Go to _server/_ and run:

- `yarn install` to install dependencies.
- `yarn db:push` to apply prisma schema on the dabase (database container has to be up).
- `yarn dev` to start the server.

Run `touch .env` to setup the configuration for dabatase connection

```
DATABASE_PORT=${db_port}
POSTGRES_USER=${db_user}
POSTGRES_PASSWORD=${db_password}
POSTGRES_DB=${db_name}
POSTGRES_HOST=postgres
POSTGRES_HOSTNAME=127.0.1.1
DATABASE_URL="postgresql://postgres:postgres@localhost:${db_port}/${db_name}?schema=public"
```

### Mobile

Go to _mobile/_ and run `yarn install` & `yarn start` to start the application.

You will need expo installed in order to ran the application, follow this guide for the [installation guide](https://docs.expo.dev/get-started/installation/)
