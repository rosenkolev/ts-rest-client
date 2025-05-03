export type HttpRequestInit = RequestInit & { config?: Record<string, unknown> };
export type HttpHandler<T = unknown> = (req: RequestInfo, init?: HttpRequestInit) => T;
export interface Interceptor<TConfig, TRes, TOut> {
  init?: (config: TConfig) => void;
  preRequest?: (request: Request, config: TConfig) => Request;
  postRequest?: (response: TRes, config: TConfig) => TOut;
}

export type InterceptorApplier<TConfig, TIn, TOut> = (
  parent: HttpHandler<TIn>,
  config?: TConfig
) => HttpHandler<TOut>;

export interface HttpClientWrapper<TIn> {
  wrap<TConfig, TOut>(
    interceptor: InterceptorApplier<TConfig, TIn, TOut>,
    config?: TConfig
  ): HttpClient<TOut>;
}

export type HttpClient<T> = HttpHandler<T> & HttpClientWrapper<T>;

// Interceptor factory
export function interceptor<TConfig = void, TIn = Promise<Response>, TOut = TIn>(handlers: {
  init?: (config?: TConfig) => void;
  preRequest?: (req: Request, config?: TConfig) => Request;
  postRequest?: (res: TIn, config?: TConfig) => TOut;
}): InterceptorApplier<TConfig, TIn, TOut> {
  const initHandler = handlers.init || (() => {});
  const preRequestHandler = handlers.preRequest || ((req: Request) => req);
  const postRequestHandler = handlers.postRequest || ((res: TIn) => res as unknown as TOut);

  return function applyInterceptor(
    parentClient: HttpHandler<TIn>,
    config?: TConfig
  ): HttpHandler<TOut> {
    initHandler(config);

    return function wrappedClient(reqInfo: RequestInfo, init?: HttpRequestInit) {
      let request = reqInfo instanceof Request ? reqInfo : new Request(reqInfo, init);
      const _config = Object.assign({}, config, init?.config);
      request = preRequestHandler(request, _config);
      const response = parentClient(request);
      return postRequestHandler(response, _config);
    };
  };
}

// HTTP client function with .wrap
export function http<T = Promise<Response>>(parentClient?: HttpHandler<T>): HttpClient<T> {
  if (!parentClient) {
    parentClient = ((reqInfo: RequestInfo, init?: RequestInit) =>
      fetch(reqInfo, init)) as HttpHandler<T>;
  }

  const clientWithWrap = parentClient as HttpClient<T>;

  clientWithWrap.wrap = function wrap<TConfig, TRes>(
    interceptorFn: InterceptorApplier<TConfig, T, TRes>,
    config?: TConfig
  ) {
    return http(interceptorFn(parentClient, config));
  };

  return clientWithWrap;
}

function isPromise<T>(obj: Promise<T> | object): obj is Promise<T> {
  return obj && 'then' in obj && typeof obj.then === 'function';
}

export const defaultJsonParser = interceptor<void, Promise<Response>, Promise<object>>({
  postRequest(res) {
    if (isPromise(res)) {
      return res.then((resp) => {
        return resp.json();
      });
    }

    return res;
  }
});

export const defaultErrorCode = interceptor<void>({
  postRequest(res) {
    if (isPromise(res)) {
      return res.then((resp) => {
        if (resp.status >= 400) throw new Error(resp.statusText);
        return resp;
      });
    }

    return res;
  }
});
