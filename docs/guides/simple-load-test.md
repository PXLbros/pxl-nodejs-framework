# Simple Load Testing

The framework ships with a lightweight CLI helper for stress testing HTTP endpoints without leaving your project.

Run scripts via npm:

```bash
npm run load:test -- --url http://localhost:3000/health
```

## Options

| Flag            | Description                                                                   | Default |
| --------------- | ----------------------------------------------------------------------------- | ------- |
| `--url`         | Target endpoint (required)                                                    | –       |
| `--requests`    | Total requests to send when duration is not set                               | `50`    |
| `--duration`    | Duration in seconds to run continuously; overrides `--requests` when provided | –       |
| `--concurrency` | Number of concurrent workers issuing requests                                 | `5`     |
| `--method`      | HTTP method                                                                   | `GET`   |
| `--body`        | Raw request body string                                                       | –       |
| `--header`      | Repeatable header flag (`--header "Header: value"`)                           | –       |

## Usage Patterns

### Fixed Request Count

```bash
npm run load:test -- --url http://localhost:3000/api/users --requests 500 --concurrency 20
```

Use this mode for fast feedback on latency distributions and status ratios after a code change.

### Fixed Duration

```bash
npm run load:test -- --url http://localhost:3000/api/users --duration 30 --concurrency 12
```

Great for soak-style checks; the script stops automatically after the requested number of seconds.

### Custom Payloads

```bash
npm run load:test -- \
  --url http://localhost:3000/api/users \
  --method POST \
  --body '{"name":"Test","email":"test@example.com"}' \
  --header 'Content-Type: application/json'
```

Repeat the `--header` flag to add authorization tokens or correlation IDs as needed. Consider storing sensitive values in environment variables instead of shell history when sharing credentials.

## Output

Each run prints latency min/avg/p50/p95/max, the number of successes and failures, and a histogram of HTTP status codes. The script also lists up to five failure examples to help you debug quickly.

## Tips

- Keep concurrency reasonable when pointing at shared environments to avoid interrupting teammates.
- Pair runs with your existing observability stack (e.g. Grafana dashboards) to correlate latency spikes with resource usage.
- Commit useful command invocations to project docs or scripts so future contributors can repeat them quickly.
