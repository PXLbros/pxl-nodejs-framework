# Logger

Structured logging utility.

## Basic

```ts
app.logger.info('Started');
app.logger.error(new Error('Boom'));
```

## Context

Attach contextual metadata per log where supported.
