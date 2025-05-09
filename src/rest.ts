import type { HttpHandler, HttpRequestInit } from './client';
import { http } from './client';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type HttpArgs = Record<string, string | number | boolean>;
type HttpDefaultClient = ReturnType<typeof http.default>;
type InferHttpHandlerConfig<T> = T extends HttpHandler<_Blob, infer C> ? C : never;

export interface RestOptions<THandler extends HttpHandler<Promise<object>, object>> {
  baseUrl: string;
  http: THandler;
  parseArgs: (args: Record<string, string | number | boolean>) => string;
  substituteRootParams: (path: string, args: Record<string, string | number | boolean>) => string;
}

export type RestSchema<T> = ((res: object) => T) | T;
export interface RestMemberBase<N extends string, M extends HttpMethod> {
  name: N;
  method: M;
}

export interface RestMethodMemberDef<
  TArgs = Record<string, string | number | boolean>,
  TRes = unknown,
  TConfig = Record<string, unknown>
> {
  path: string;
  args?: TArgs;
  schema?: RestSchema<TRes>;
  config?: TConfig;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultHttpResult = any;
type _RestMember<
  TArgs = Record<string, string | number | boolean>,
  TRes = DefaultHttpResult
> = RestMethodMemberDef<TArgs, TRes> & RestMemberBase<string, HttpMethod>;

export type RestMethodMemberCreator<TConfig, TMethod extends HttpMethod> = <
  TName extends string,
  TArgs = HttpArgs,
  TRes = object
>(
  name: TName,
  opts?: Partial<RestMethodMemberDef<TArgs, TRes, TConfig>>
) => RestMethodMemberDef<TArgs, TRes, TConfig> & { name: TName; method: TMethod };

export interface RestCreateFunctions<TConfig> {
  member<TName extends string, TMethod extends HttpMethod, TArgs = HttpArgs, TRes = object>(
    name: TName,
    method: TMethod,
    opts?: RestMethodMemberDef<TArgs, TRes, TConfig>
  ): RestMethodMemberDef<TArgs, TRes, TConfig> & { name: TName; method: TMethod };

  readonly get: RestMethodMemberCreator<TConfig, 'GET'>;
  readonly post: RestMethodMemberCreator<TConfig, 'POST'>;
  readonly patch: RestMethodMemberCreator<TConfig, 'PATCH'>;
  readonly put: RestMethodMemberCreator<TConfig, 'PUT'>;
  readonly del: RestMethodMemberCreator<TConfig, 'DELETE'>;
  readonly namespace: <TName extends string, TRest extends RestMember[]>(
    name: TName,
    createChildren: (fn: RestCreateFunctions<TConfig>) => TRest
  ) => {
    name: TName;
    children: TRest;
  };
}

type InferRestRes<T> = T extends RestSchema<infer R> ? R : never;

interface _RestNamespace {
  name: string;
  children: RestMember[];
}

type RestMember = _RestMember | _RestNamespace;

export type RestMethodFn<TConfig, TArgs extends HttpArgs, TRes = unknown> = (
  args?: TArgs | null,
  config?: HttpRequestInit<TConfig>
) => TRes;

type MapMember<M extends RestMember, TConfig> = M extends _RestNamespace
  ? { [K in M['name']]: InferRest<M['children'], TConfig> }
  : M extends _RestMember
    ? {
        [K in M['name']]: RestMethodFn<
          TConfig,
          NonNullable<M['args']>,
          Promise<InferRestRes<NonNullable<M['schema']>>>
        >;
      }
    : never;

type MapMembers<T extends readonly RestMember[], TConfig> = {
  [K in keyof T]: T[K] extends RestMember ? MapMember<T[K], TConfig> : never;
}[number]; // Union of mapped members

type MergeUnion<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void
  ? { [K in keyof I]: I[K] }
  : never;

export type InferRest<T extends readonly RestMember[], TConfig> = MergeUnion<
  MapMembers<T, TConfig>
>;

// Functions

const member = <TName extends string, X extends HttpMethod, TArgs = HttpArgs, TRes = object>(
  name: TName,
  method: X,
  opts?: RestMethodMemberDef<TArgs, TRes>
) => ({
  ...opts,
  path: opts?.path ?? `/${name}`,
  name,
  method
});

const bindMember =
  <X extends HttpMethod>(method: X) =>
  <T extends string, TArgs = HttpArgs, TRes = object>(
    name: T,
    config?: RestMethodMemberDef<TArgs, TRes>
  ) =>
    member<T, X, TArgs, TRes>(name, method, config);

const createFunctions = Object.freeze({
  member,
  get: bindMember('GET'),
  post: bindMember('POST'),
  patch: bindMember('PATCH'),
  put: bindMember('PUT'),
  del: bindMember('DELETE'),
  namespace: <TName extends string, TRest extends RestMember[]>(
    name: TName,
    createChildren: (fn: typeof createFunctions) => TRest
  ) => ({
    name,
    children: createChildren(createFunctions)
  })
});

function urlJoin(base: string, path: string) {
  if (base[base.length - 1] !== '/') base += '/';
  if (path[0] === '/') path = path.substring(1);
  return base + path;
}

function isNone<T>(obj: T | null | undefined): obj is null | undefined {
  return obj === null || typeof obj === 'undefined';
}

// 🔧 Recursive function builder
function buildFromMembers(
  basePath: string,
  members: Readonly<RestMember[]>,
  options: RestOptions<HttpHandler<Promise<object>, object>>
): Record<string, object> {
  const obj: Record<string, object> = {};

  for (const member of members) {
    if ('children' in member) {
      obj[member.name] = buildFromMembers(urlJoin(basePath, member.name), member.children, options);
    } else {
      obj[member.name] = (
        args?: Record<string, string | number | boolean> | null,
        init: HttpRequestInit<object> = {}
      ) => {
        const noArgs = isNone(args) && isNone(member.args);
        const finalArgs = noArgs ? {} : { ...(member.args || {}), ...(args || {}) };
        const noBody = member.method === 'GET' || member.method === 'DELETE';
        const urlPath = options.substituteRootParams(urlJoin(basePath, member.path), finalArgs);
        const finalConfig = { ...(member.config || {}), ...(init.config || {}) };
        const finalUrl = noArgs || !noBody ? urlPath : `${urlPath}?${options.parseArgs(finalArgs)}`;
        const data = noBody || noArgs ? null : finalArgs;
        const fetchInit: HttpRequestInit<object> = {
          ...init,
          method: member.method,
          headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {})
          },
          config: finalConfig,
          data
        };

        const result = options.http(finalUrl, fetchInit);
        return typeof member.schema === 'function'
          ? result.then(member.schema as (res: object) => object)
          : result;
      };
    }
  }

  return obj;
}

function defaultParseQuery(args: Record<string, string | number | boolean>) {
  return Object.entries(args)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export function rest<THandler extends HttpHandler<Promise<object>, object> = HttpDefaultClient>(
  restOptions?: Partial<RestOptions<THandler>>
) {
  if (typeof restOptions === 'undefined' || restOptions === null) {
    restOptions = {};
  }

  const opts: RestOptions<THandler> = {
    baseUrl: restOptions.baseUrl ?? document.baseURI ?? '/',
    http: (restOptions.http ?? http.default()) as THandler,
    parseArgs: restOptions.parseArgs ?? defaultParseQuery,
    substituteRootParams:
      restOptions.substituteRootParams ??
      ((path, args) => path.replace(/:([^/]+)/g, (_, key: string) => encodeURIComponent(args[key])))
  };

  const restCreators = createFunctions as RestCreateFunctions<InferHttpHandlerConfig<THandler>>;
  return <T extends readonly RestMember[]>(
    path: string,
    define: (fn: RestCreateFunctions<InferHttpHandlerConfig<THandler>>) => T
  ) => {
    const members = define(restCreators);
    return buildFromMembers(urlJoin(opts.baseUrl, path), members, opts) as InferRest<
      T,
      InferHttpHandlerConfig<THandler>
    >;
  };
}
