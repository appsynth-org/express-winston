import { Request, Response } from 'express';
import TransportStream from 'winston-transport';

export interface Payload {
  transports?: TransportStream | TransportStream[];
  level?: string;
  msg?: string;
  defaultMeta?: {};
  logReqBody?: boolean;
  logReqBodyOnly?: string[];
  logReqBodyExcept?: string[];
  logResBody?: boolean;
  logResBodyOnly?: string[];
  logResBodyExcept?: string[];
  skip?: (req: Request, res: Response) => boolean;
}

export interface ReqObj {
  headers?: any;
  method?: string;
  path?: string;
  ip?: string;
  body?: any;
}

export interface ResObj {
  statusCode?: any;
  type?: any;
  headers?: any;
  body?: any;
}
