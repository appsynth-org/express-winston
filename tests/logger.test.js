const express = require('express');
const Transport = require('winston-transport');
const request = require('supertest');
const logger = require('../src/logger').default; // eslint-disable-line

class CustomTransport extends Transport {
  constructor(msgs = []) {
    super();
    this.msgs = msgs;
  }

  log(info, callback) {
    this.msgs.push(info);
    callback(null, true);
  }
}

const defaultHandler = async (req, res) => {
  res.send('cool');
};

const useLogger = (payload, handler = defaultHandler) => {
  const app = express();
  app.use(express.json());
  app.use(logger(payload));
  app.use(handler);

  return app.listen();
};

describe('logger', () => {
  test('log level should be warn when status=400', async (done) => {
    const msgs = [];
    const warnHandler = async (req, res) => {
      res.sendStatus(400);
    };

    const app = useLogger(
      {
        transports: [new CustomTransport(msgs)],
      },
      warnHandler
    );

    await request(app)
      .post('/test')
      .expect(400)
      .then(() => {
        app.close();
      });

    const [{ level }] = msgs;
    expect(level).toBe('warn');
    done();
  });

  test('cookies should still exist', async (done) => {
    const msgs = [];
    let cookie = '';
    const cookieHandler = (req, res) => {
      const {
        headers: { cookie: requestCookie },
      } = req;
      cookie = requestCookie;
      res.send('woot!');
    };

    const app = useLogger(
      {
        transports: [new CustomTransport(msgs)],
      },
      cookieHandler
    );
    await request(app)
      .post('/test')
      .set('Cookie', 'ding=dong')
      .expect(200)
      .then(() => {
        app.close();
      });

    const [{ level }] = msgs;
    expect(level).toBe('info');
    expect(cookie).toBe('ding=dong');
    done();
  });

  test('successful required logger', async () => {
    expect(logger).toBeTruthy();
  });

  test('successful create default middleware', async (done) => {
    const app = useLogger();
    await request(app)
      .get('/')
      .expect(200)
      .then(() => {
        app.close();
      });
    done();
  });

  test('successful display of correct url in message', async (done) => {
    const msgs = [];
    const app = useLogger({
      transports: [new CustomTransport(msgs)],
    });
    await request(app)
      .post('/test')
      .expect(200)
      .then(() => app.close());
    const [{ message }] = msgs;
    expect(message).toBe('request success for POST /test');
    done();
  });

  test('should use input level as default level', async (done) => {
    const msgs = [];
    const app = useLogger({
      level: 'error',
      transports: [new CustomTransport(msgs)],
    });
    await request(app)
      .post('/test')
      .expect(200)
      .then(() => app.close());
    const [{ level }] = msgs;
    expect(level).toBe('error');
    done();
  });

  // TODO: FIX ME
  test('should still record log when error has been thrown', async (done) => {
    const msgs = [];
    const errorHandler = async (req, res, next) => {
      try {
        throw new Error('A test error occurred');
      } catch (e) {
        next(e);
      }
    };
    const app = useLogger(
      {
        transports: [new CustomTransport(msgs)],
      },
      errorHandler
    );
    await request(app).post('/test').expect(500);
    app.close();
    const [{ level }] = msgs;
    expect(level).toBe('error');
    done();
  });

  test('should be able to log request body if enabled', async (done) => {
    const msgs = [];
    const app = useLogger({
      transports: [new CustomTransport(msgs)],
      logReqBody: true,
    });
    await request(app).post('/test').send({ name: 'John' }).expect(200);
    app.close();
    const [
      {
        level,
        req: { body },
      },
    ] = msgs;
    expect(level).toBe('info');
    expect(body).toMatchObject({ name: 'John' });
    done();
  });

  test('should not log request body if route is blacklisted', async (done) => {
    const msgs = [];
    const app = useLogger({
      transports: [new CustomTransport(msgs)],
      logReqBody: true,
      logReqBodyExcept: ['/noreqbodylog'],
    });
    await request(app).post('/noreqbodylog').send({ name: 'John' }).expect(200);
    app.close();
    const [
      {
        level,
        req: { body },
      },
    ] = msgs;
    expect(level).toBe('info');
    expect(body).toBe(undefined);
    done();
  });

  test('should only log request body on routes that are whitelisted', async (done) => {
    const msgs = [];
    const app = useLogger({
      transports: [new CustomTransport(msgs)],
      logReqBody: true,
      logReqBodyOnly: ['/'],
      logReqBodyExcept: ['/test'],
    });
    await request(app).post('/test2').send({ name: 'John' }).expect(200);
    await request(app).post('/').send({ name: 'John' }).expect(200);
    await request(app).post('/test2').send({ name: 'John' }).expect(200);
    app.close();
    const [
      {
        level: level1,
        req: { body: body1 },
      },
      {
        level: level2,
        req: { body: body2 },
      },
      {
        level: level3,
        req: { body: body3 },
      },
    ] = msgs;
    expect(level1).toBe('info');
    expect(body1).toBe(undefined);
    expect(level2).toBe('info');
    expect(body2).toMatchObject({ name: 'John' });
    expect(level3).toBe('info');
    expect(body3).toBe(undefined);
    done();
  });

  test('should be able to log response body if enabled', async (done) => {
    const msgs = [];
    const app = useLogger(
      {
        transports: [new CustomTransport(msgs)],
        logResBody: true,
      },
      async (req, res) => {
        res.json({ password: 'secret', cc: '1111-1111-1111-1111' });
      }
    );
    await request(app).post('/test').expect(200);
    app.close();
    const [
      {
        level,
        res: { body },
      },
    ] = msgs;
    expect(level).toBe('info');
    expect(body).toMatchObject({ password: '[REDACTED]', cc: '[REDACTED]' });
    done();
  });

  test('should not log response body if route is blacklisted', async (done) => {
    const msgs = [];
    const app = useLogger(
      {
        transports: [new CustomTransport(msgs)],
        logResBody: true,
        logResBodyExcept: ['/noresbody'],
      },
      async (req, res) => {
        res.json({ success: true });
      }
    );
    await request(app).post('/noresbody').expect(200);
    app.close();
    const [
      {
        level,
        res: { body },
      },
    ] = msgs;
    expect(level).toBe('info');
    expect(body).toBe(undefined);
    done();
  });

  test('should only log response body on routes that are whitelisted', async (done) => {
    const msgs = [];
    const app = useLogger(
      {
        transports: [new CustomTransport(msgs)],
        logResBody: true,
        logResBodyOnly: ['/'],
        logResBodyExcept: ['/test'],
      },
      async (req, res) => {
        res.send({ success: true });
      }
    );
    await request(app).post('/test2').expect(200);
    await request(app).post('/').expect(200);
    await request(app).post('/test2').expect(200);
    app.close();
    const [
      {
        level: level1,
        res: { body: body1 },
      },
      {
        level: level2,
        res: { body: body2 },
      },
      {
        level: level3,
        res: { body: body3 },
      },
    ] = msgs;
    expect(level1).toBe('info');
    expect(body1).toBe(undefined);
    expect(level2).toBe('info');
    expect(body2).toMatchObject({ success: true });
    expect(level3).toBe('info');
    expect(body3).toBe(undefined);
    done();
  });

  test('should redact sensitive information', async (done) => {
    const msgs = [];
    const app = useLogger({
      transports: [new CustomTransport(msgs)],
      logReqBody: true,
    });
    await request(app).post('/test').send({ password: 'secretpassword' }).expect(200);
    app.close();
    const [
      {
        level,
        req: { body },
      },
    ] = msgs;
    expect(level).toBe('info');
    expect(body.password).toBe('[REDACTED]');
    done();
  });

  test('should log user data if it exist in request', async (done) => {
    const msgs = [];
    const app = useLogger(
      {
        transports: [new CustomTransport(msgs)],
      },
      async (req, res) => {
        res.locals.user = {
          id: 123,
        };
        res.sendStatus(200);
      }
    );
    await request(app).post('/test').expect(200);
    app.close();
    const [{ level, user }] = msgs;
    expect(level).toBe('info');
    expect(user).toMatchObject({ id: 123 });
    done();
  });

  test('correlation id must be the same as request header', async (done) => {
    const msgs = [];
    const app = useLogger({
      transports: [new CustomTransport(msgs)],
    });
    await request(app).post('/test').set({ 'x-correlation-id': '123123' }).expect(200);
    app.close();
    const [
      {
        req: { headers },
        requestId,
      },
    ] = msgs;
    expect(requestId).toBe(headers['x-correlation-id']);
    done();
  });

  test('correlation id from log must be the same as the one attached on res local', async (done) => {
    const msgs = [];
    const app = useLogger(
      {
        transports: [new CustomTransport(msgs)],
      },
      async (req, res) => {
        return res.send(res.locals.requestId);
      }
    );

    const { text } = await request(app).post('/test').expect(200);

    app.close();
    const [{ requestId }] = msgs;
    expect(requestId).toBe(text);
    done();
  });

  test('adding extra defaultMeta', async (done) => {
    const msgs = [];
    const app = useLogger({
      defaultMeta: {
        service: {
          name: 'Test service',
        },
      },
      transports: [new CustomTransport(msgs)],
    });
    await request(app)
      .post('/test')
      .expect(200)
      .then(() => app.close());
    const [{ message }] = msgs;
    expect(message).toBe('request success for POST /test');
    done();
  });

  test('multiple request', async (done) => {
    const app = useLogger();
    await request(app)
      .get('/')
      .expect(200)
      .then(() => {
        app.close();
      });
    done();
  });

  test('it should not log if user-agent is from kube-probe', async (done) => {
    const msgs = [];
    const app = useLogger({
      transport: [new CustomTransport(msgs)],
    });

    await request(app)
      .post('/test')
      .set('user-agent', 'kube-probe/1.10')
      .expect(200)
      .then(() => app.close());

    expect(msgs.length).toBe(0);

    done();
  });

  test('it should not log if skip condition was met', async (done) => {
    const msgs = [];
    const app = useLogger({
      transports: [new CustomTransport(msgs)],
      skip: (req, res) => {
        return req.url === '/skip';
      },
    });
    await request(app)
      .post('/skip')
      .expect(200)
      .then(() => app.close());

    expect(msgs.length).toBe(0);

    done();
  });
});
