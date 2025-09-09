# Services

Encapsulate domain logic. Keep them stateless where possible and inject dependencies explicitly.

```ts
class EmailService {
  constructor(private app: Application) {}
  async sendWelcome(user: User) {
    await this.app.queue.manager.add('email', { userId: user.id });
  }
}
```
