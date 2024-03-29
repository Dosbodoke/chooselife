# **CHOOSELIFE**

An open source API and a mobile client made for Highliners!

This repository is composed by two modules:

`./mobile/`: A mobile app built with React Native (EXPO).

`./server/`: Type safe api built with Express + tRPC + Prisma.

# Table of contents

- [Setup clerk](#setup-clerk)
- [Run Locally](#run-locally)
  - [Database](#database)
  - [Server](#server)
  - [Mobile](#mobile)
- [Tech Stack](#tech-stack)
- [Recommended VSCode extensions](#recommended-vscode-extensions)

## Setup clerk

The project uses clerk for authentication and user management. It should be configured in order to run both locally and on production.

- Create a new application on [clerk dashboard](https://dashboard.clerk.com/)

- On the tab **configure => User & Authentication => Email, Phone, Username** enable the following buttons:

  - Email address
  - Password
  - Email verification code

- On the tab **configure => User & Authentication => Social Connections** enable the following services:

  - Google
  - Apple

- On the tab **developers => API KEYS** copy the Publishable key and paste it on `mobile/.env`

```
CLERK_PUBLISHABLE_KEY= # KEY FROM YOUR CLERK APPLICATION
```

## Run Locally

Clone the project from [this repository](https://github.com/Dosbodoke/high-xp) and go to the project directory.

### Backend

The Database and API run in a Docker container (+pgadming for databas administration on the browser).

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

You can access the PgAdmin dashboard via browser on [http://localhost:${PORT}/](). Use `${EMAIL}` and `${PASSWORD}` to login.

#### Server

```
    environment
      DATABASE_PORT: ${db_port}
      POSTGRES_USER: ${db_user}
      POSTGRES_PASSWORD: ${db_password}
      POSTGRES_DB: ${db_name}
      POSTGRES_HOST: postgres
      POSTGRES_HOSTNAME: 127.0.1.1
      DATABASE_URL: postgresql://postgres:postgres@chooselife_postgres:${db_port}/${db_name}?schema=public
```

---

### Mobile

Go to `mobile/` and run `yarn install && yarn start` to start the application.

You will need expo installed in order to ran the application, follow this guide for the [installation guide](https://docs.expo.dev/get-started/installation/)

Set-up the `.env` file following the `.env.example` schema

## Tech Stack 💜

**📱 Mobile:**

- [Expo](https://github.com/expo/expo)
- [TypeScript](https://github.com/microsoft/TypeScript)
- [NativeWind](https://github.com/marklawlor/nativewind) _(Tailwind para o React Native)_

**🏧 Server:**

- [Express](https://github.com/expressjs/express) `(REST)`
- [tRPC](https://github.com/trpc/trpc)
- [Prisma](https://github.com/prisma/prisma)
- [PostgreSQL](https://github.com/postgres)
- [TypeScript](https://github.com/microsoft/TypeScript)

## Recommended VSCode extensions

For any reasons, if the notification doesn't show up we can manually open up Recommended Extensions settings

- Open the command palette CMD + Shift + p
- Type Show Recommended Extensions
- All the extensions can be installed together or only required extensions can be installed

To understand more, refer to [this article from Krishna Pravin](https://dev.to/askrishnapravin/recommend-vs-code-extensions-to-your-future-teammates-4gkb)
