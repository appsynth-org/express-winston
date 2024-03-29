import winston from 'winston';
import onFinished from 'on-finished';
import cuid from 'cuid';
import Redact from './redact-secrets';
import { Payload, ReqObj, ResObj } from './types';
import { Request, Response, NextFunction } from 'express';
import debug from 'debug';

const redact = Redact('[REDACTED]');
const d = debug('appsynth-logger');

const isJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

const {
  createLogger,
  format: { combine: wfcombine },
} = winston;

const C = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
  MSG: 'HTTP %s %s',
};

const getLogLevel = (statusCode: number = 200, defaultLevel = C.INFO) => {
  switch (Math.floor(statusCode / 100)) {
    case 5:
      return C.ERROR;
    case 4:
      return C.WARN;
    default:
      return defaultLevel;
  }
};

const logger = (payload: Payload = {}) => {
  const skipKubePropeReq = (req: Request, res: Response) => {
    return req.headers['user-agent'] && req.headers['user-agent'].includes('kube-probe');
  };

  const {
    transports = [new winston.transports.Console()],
    level = C.INFO,
    msg = C.MSG,
    logReqBody = false,
    logReqBodyOnly = [],
    logReqBodyExcept = [],
    logResBody = false,
    logResBodyOnly = [],
    logResBodyExcept = [],
    defaultMeta = {},
    skip = skipKubePropeReq,
  } = payload;

  const reqSerializer = (req: Request) => {
    const reqObj: ReqObj = {
      headers: req.headers,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    };

    if (logReqBody && logReqBodyOnly.includes(req.originalUrl)) {
      reqObj.body = req.body;
    }

    if (logReqBody && logReqBodyOnly.length <= 0 && !logReqBodyExcept.includes(req.originalUrl)) {
      reqObj.body = req.body;
    }

    return reqObj;
  };

  const resSerializer = (res: Response) => {
    const resObj: ResObj = {
      statusCode: res.statusCode,
      type: res.getHeader('content-type'),
      headers: res.getHeaders(),
    };

    if (logResBody && logResBodyOnly.includes(res.req?.path || '')) {
      resObj.body = res.locals.body;
      delete res.locals.body;
    }

    if (logResBody && logResBodyOnly.length <= 0 && !logResBodyExcept.includes(res.req?.path || '')) {
      resObj.body = res.locals.body;
      delete res.locals.body;
    }

    return resObj;
  };

  const onResponsedFinished = (req: Request, res: Response, info: any) => {
    info.level = getLogLevel(res.statusCode, level);
    const result = info.level === C.INFO ? 'success' : 'error';
    info.message = `request ${result} for ${req.method} ${req.originalUrl}`;

    const metadata: any = {
      responseTime: Date.now() - info.started_at,
      req: req ? reqSerializer(req) : {},
      res: res ? resSerializer(res) : {},
    };

    // @ts-ignore
    if (res.locals.user || req.user) {
      // @ts-ignore
      metadata.user = res.locals.user || req.user;
    }

    res.locals.logger.log(info.level, info.message, metadata);
  };

  const winstonLogger = createLogger({
    transports,
    level,
    defaultMeta: {
      ...{ env: process.env.NODE_ENV },
      ...defaultMeta,
    },
    format: wfcombine(
      // redact insecure information
      winston.format((info) => redact.map(info))(),
      winston.format.json()
    ),
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    // assign correlation id into the context
    // use the one from req header if it exists, otherwise generate a new one
    const requestId = (req.headers && req.headers['x-correlation-id']) || cuid();
    res.locals.requestId = requestId;

    const oldWrite = res.write;
    const oldEnd = res.end;

    const chunks: any = [];

    res.write = (...args: any) => {
      chunks.push(Buffer.from(args[0]));
      return oldWrite.apply(res, args);
    };

    res.end = (...args: any) => {
      if (args[0]) {
        chunks.push(Buffer.from(args[0]));
      }
      const resBody = Buffer.concat(chunks).toString('utf-8');

      res.locals.body = isJSON(resBody) ? JSON.parse(resBody) : resBody;

      oldEnd.apply(res, args);
    };

    const info: any = { req, started_at: Date.now() };

    res.locals.logger = winstonLogger.child({ requestId });

    let error;
    try {
      await next();
    } catch (e) {
      // catch and throw it later
      error = e;
    } finally {
      const maybeSkip = skip(req, res);
      if (!maybeSkip) {
        // @ts-ignore
        onFinished(res, onResponsedFinished.bind(null, req, res, info));
      } else {
        d(`${req.originalUrl} is skipped`);
      }
    }

    if (error) {
      throw error;
    }
  };
};

export default logger;
