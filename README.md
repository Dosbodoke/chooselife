# CHOOSELIFE

An open source API and a mobile client made for Highliners!

This repository is composed by two modules

`./mobile/`: A mobile app built with React Native (EXPO).
`./server/`: Type safed api built with tRPC and Prisma.

## Run Locally

Clone the project from [this repository](https://github.com/Dosbodoke/high-xp) and go to the project directory.

Now you need to start the database docker container (+pgadming for databas administration on the browser).

```bash
  docker-compose up --build
```

### Mobile app

Go to mobile/ and run `yarn install` & `yarn serve` to start the application.

You will need expo installed in order to ran the application, follow this guide for the [installation guide](https://docs.expo.dev/get-started/installation/)

## Environment Variables

Set you configs on `docker-compose.yml`

# postgres

```environment
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: db_name
      POSTGRES_HOST: postgres
      DATABASE_PORT: 6500
      POSTGRES_HOSTNAME: 127.0.0.1
```

# pgadmin

```
  ports:
    - "${PORT}:80"
  environment:
    PGADMIN_DEFAULT_EMAIL: ${EMAIL}
    PGADMIN_DEFAULT_PASSWORD: ${PASSWORD}
```

Tou can access the PgAdmin dashboard via browser on [http://localhost:${PORT}/]()

Use `${EMAIL}` and `${PASSWORD}` to login.
