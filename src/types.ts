export interface Payload {
  transports?: any;
  level?: string;
  msg?: string;
  defaultMeta?: {};
  logReqBody?: boolean;
  logReqBodyOnly?: string[];
  logReqBodyExcept?: string[];
  logResBody?: boolean;
  logResBodyOnly?: string[];
  logResBodyExcept?: string[];
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
