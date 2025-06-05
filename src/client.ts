// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type HttpRequestInit<TConfig = {}> = RequestInit & {
  config?: TConfig;
  data?: object | null;
};
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type HttpHandler<T = Promise<object>, TConfig = {}> = (
  req: RequestInfo,
  init: HttpRequestInit<TConfig>
) => T;

export interface Interceptor<TConfig, TRes, TOut> {
  init?: (config: TConfig) => void;
  preRequest?: (request: Request, config: TConfig) => Request;
  postRequest?: (response: TRes, config: TConfig) => TOut;
}

export type InterceptorApplier<TConfig, TIn, TOut> = (
  parent: HttpHandler<TIn>,
  config?: Partial<TConfig>
) => HttpHandler<TOut, TConfig>;

export interface HttpClientWrapper<TIn, PConfig> {
  wrap<TConfig, TOut>(
    interceptor: InterceptorApplier<TConfig, TIn, TOut>,
    config?: Partial<TConfig>
  ): HttpClient<TOut, PConfig | TConfig>;
}

export type HttpClient<T, TConfig> = ((req: RequestInfo, init?: HttpRequestInit<TConfig>) => T) &
  HttpClientWrapper<T, TConfig>;

// Interceptor factory
const defaultRequestHandler = <TIn, TOut>(req: TIn) => req as unknown as TOut;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function interceptor<TConfig = {}, TIn = Promise<Response>, TOut = TIn>(handlers: {
  init?: (config: TConfig) => TConfig;
  preRequest?: (req: Request, config: TConfig, init?: HttpRequestInit<TConfig>) => Request;
  postRequest?: (res: TIn, config: TConfig) => TOut;
  defaultConfig?: TConfig;
}): InterceptorApplier<TConfig, TIn, TOut> {
  const initHandler = handlers.init || defaultRequestHandler;
  const preRequestHandler = handlers.preRequest || defaultRequestHandler;
  const postRequestHandler = handlers.postRequest || defaultRequestHandler;

  return function applyInterceptor(
    parentClient: HttpHandler<TIn>,
    config?: Partial<TConfig>
  ): HttpHandler<TOut, TConfig> {
    config = initHandler({ ...handlers.defaultConfig, ...config } as TConfig);

    return function wrappedClient(reqInfo: RequestInfo, init?: HttpRequestInit<TConfig>) {
      let request = reqInfo instanceof Request ? reqInfo : new Request(reqInfo, init);
      const _config = Object.assign({}, config, init?.config) as TConfig;
      request = preRequestHandler(request, _config, init);
      const response = parentClient(request, init as HttpRequestInit<object>);
      return postRequestHandler(response, _config);
    };
  };
}

// HTTP client function with .wrap
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function http<T = Promise<Response>, C = {}>(
  parentClient?: HttpHandler<T, C>
): HttpClient<T, C> {
  if (!parentClient) {
    parentClient = ((reqInfo: RequestInfo, init?: RequestInit) =>
      fetch(reqInfo, init)) as HttpHandler<T, C>;
  }

  const clientWithWrap = parentClient as HttpClient<T, C>;

  clientWithWrap.wrap = function wrap<TConfig, TRes>(
    interceptorFn: InterceptorApplier<TConfig, T, TRes>,
    config?: Partial<TConfig>
  ) {
    return http(interceptorFn(parentClient as HttpHandler<T>, config)) as HttpClient<
      TRes,
      C | TConfig
    >;
  };

  return clientWithWrap;
}

function isPromise<T>(obj: Promise<T> | object): obj is Promise<T> {
  return obj && 'then' in obj && typeof obj.then === 'function';
}

export const httpBodySerialize = interceptor<{ appendContentType: boolean }>({
  preRequest(req, config, init) {
    if (init && typeof init.data !== 'undefined' && init.data !== null) {
      return new Request(req, {
        ...init,
        body: JSON.stringify(init.data),
        headers:
          config.appendContentType === true
            ? { ...(init.headers ?? {}), 'Content-Type': 'application/json' }
            : init.headers
      });
    }

    return req;
  },
  defaultConfig: {
    appendContentType: true
  }
});

export const httpJsonParser = interceptor({
  postRequest(res: Promise<Response>) {
    return isPromise(res) ? res.then((resp) => resp.json()) : res;
  }
});

export const httpErrorCode = interceptor<{ errorCode: number }>({
  postRequest(res, config) {
    return res.then((resp) => {
      if (resp.status >= config.errorCode) throw new Error(resp.statusText);
      return resp;
    });
  },
  defaultConfig: {
    errorCode: 400
  }
});

http.default = () => http().wrap(httpBodySerialize).wrap(httpErrorCode).wrap(httpJsonParser);
