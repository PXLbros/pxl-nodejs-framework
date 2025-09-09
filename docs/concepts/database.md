# Database

Backed by MikroORM.

## Config

Provide MikroORM options in the `database` key when constructing the application.

```ts
const app = new Application({
  database: {
    entities: [
      /* ... */
    ],
    dbName: 'app',
    type: 'postgresql',
  },
});
```

## Usage

```ts
await app.database.orm.em.find(User, {});
```

## Migrations

Use MikroORM CLI separately (not yet wrapped). Keep migrations in a `migrations/` folder.
