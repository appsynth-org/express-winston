# express-winston

Appsynth's Winston logger Express middleware.

## Features

- Redacts sensitive information automatically (token, password, credit card...)
- Optionally allows you to log request and response body for specific routes
- A unique request ID is assigned to each request that has multiple logs
- The generated unique request Id can also act as a correlation id for outgoing requests (`res.locals.requestId`)
- Logs user information if data is attached to the context (`res.locals.user`)

## Usage

### Installation

```
npm i @appsynth-org/express-winston --save
```

### Quick Start

```javascript
const logger = require('@appsynth-org/express-winston');
app.use(logger());
```

Request log will look like:

```json
{
  "requestId": "ckagm39qh0000ek1gc108gz7d",
  "req": {
    "headers": {
      "host": "localhost:3000",
      "connection": "keep-alive",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
      "accept": "*/*",
      "accept-encoding": "gzip, deflate, br",
      "cache-control": "no-cache"
    },
    "path": "/login",
    "method": "POST",
    "ip": "::1"
  },
  "res": {
    "type": "application/json",
    "statusCode": 200,
    "headers": {
      "content-length": "16",
      "content-type": "application/json; charset=utf-8"
    }
  },
  "responseTime": 8,
  "level": "info",
  "message": "request success for POST /login"
}
```

## Configuration

```javascript
app.use(
  logger({
    transports: [new winston.transports.Console()],
    level: 'info',
    logReqBody: false,
    logReqBodyExcept: [],
    logResBody: false,
    logResBodyExcept: [],
  })
);
```

## Examples

### NOTE: CommonJS usage

In order to gain the TypeScript typings (for intellisense / autocomplete) while ussing CommonJS imports with `require()`, use the following approach:

```javascript
const logger = require('@appsynth-org/express-winston').default;
```

### Correlation ID

This logging library assigns a unique id to each request and its value is accessible through `res.locals.requestId`.

The unique id is generated in either of these two ways:

1. The `res.locals.requestId` will use the value of the `x-correlation-id` header of the incoming request.
2. If `x-correlation-id` doesn't exist in incoming request header, it will generate on its own using `cuid`.

You can use the value of `res.locals.requestId` as the `x-correlation-id` request header for your outgoing request as such:

```javascript
app.use(async (req, res) => {
  const response = await axios.get('http://localhost:3000', {
    headers: {
      'x-correlation-id': res.locals.requestId,
    },
  });
});
```

This way, the service who sent the request and the service who is receiving the request will have the same `requestId` in the log.

### Specifying logging transports

```javascript
const { LoggingWinston } = require('@google-cloud/logging-winston');

app.use(
  logger({
    transports: [
      new LoggingWinston({
        projectId: 'gcp-project-id',
        keyFilename: 'account-service.json',
        logName: 'appsynth-express-winston',
        serviceContext: {
          service: 'appsynth-express-winston',
          version: 'v1.0.0',
        },
      }),
    ],
  })
);
```

### Logging all request and response bodies

```javascript
app.use(
  logger({
    logResBody: true,
  })
);
```

### Logging all request and response bodies except for specific routes

```javascript
app.use({
  logger({
    logReqBody: true,
    logReqBodyExcept: [
      '/register',
      '/login'
    ],
    logResBody: true,
    logResBodyExcept: [
      '/register',
      '/login'
    ]
  })
})
```

### Adding extra logs to your router

```javascript
async (req, res) => {
  res.locals.logger.info('Request received');
  res.send('Cool!)
};
```

## Contributing

- If you're unsure if a feature would make a good addition, you can always [create an issue](https://bitbucket.org/appsynth/express-winston/issues/new) first. Raising an issue before creating a pull request is recommended.
- We aim for 100% test coverage. Please write tests for any new functionality or changes.
- Any API changes should be fully documented.
- Make sure your code meets our linting standards. Run `npm run lint` to check your code.
- Maintain the existing coding style.
- Be mindful of others when making suggestions and/or code reviewing.
