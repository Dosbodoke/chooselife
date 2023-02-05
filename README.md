# CHOOSELIFE

An public APi and a client built on React Native made for Highliners!

## Run Locally

Clone the project

```bash
  git clone https://bitbucket.org/jgo_certi/poc_iana_streaming/src/main/
```

Go to the project directory

```bash
  cd poc_iana_streaming
```

Start the client

```bash
  docker-compose up --build main
```

Open http://localhost:8080/

Now run the publisher

```bash
  docker-compose up --build publisher
```

See the images being displayed on the web page

## Environment Variables

Set you configs on `docker-compose.yml`

# postgres

```dockerflie
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: db_name
      POSTGRES_HOST: postgres
      DATABASE_PORT: 6500
      POSTGRES_HOSTNAME: 127.0.0.1
```

# pgadmin

```
  pgadmin:
    image: dpage/pgadmin4
    container_name: pgadmin
    depends_on:
      - postgres
    ports:
      - "${PORT}:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: ${EMAIL}
      PGADMIN_DEFAULT_PASSWORD: ${PASSWORD}
    volumes:
      - pgadmin-data:/var/lib/pgadmin
    restart: unless-stopped
```

Tou can access the PgAdmin dashboard via browser on [http://localhost:${PORT}/]()

Use `${EMAIL}` and `${PASSWORD}` to login.
