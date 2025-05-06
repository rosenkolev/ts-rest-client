import type { HttpHandler, HttpRequestInit } from './client';
import { http } from './client';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type HttpArgs = Record<string, string | number | boolean>;

export interface RestOptions {
  baseUrl: string;
  http: HttpHandler<Promise<object>>;
  parseArgs: (args: Record<string, string | number | boolean>) => string;
  substituteRootParams: (path: string, args: Record<string, string | number | boolean>) => string;
}

export type RestSchema<T> = ((res: object) => T) | T;
export interface RestMethodMemberDef<
  TArgs = Record<string, string | number | boolean>,
  TRes = unknown
> {
  path: string;
  args?: TArgs;
  schema?: RestSchema<TRes>;
  config?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultHttpResult = any;
export interface RestMemberDef<
  TArgs = Record<string, string | number | boolean>,
  TRes = DefaultHttpResult
> extends RestMethodMemberDef<TArgs, TRes> {
  name: string;
  method: HttpMethod;
}

type InferRestRes<T> = T extends RestSchema<infer R> ? R : never;

export interface RestNamespaceDef {
  name: string;
  children: RestMember[];
}

type RestMember = RestMemberDef | RestNamespaceDef;

export type RestMethodFn<TArgs extends HttpArgs, TRes = unknown> = (
  args?: TArgs,
  config?: HttpRequestInit
) => TRes;

type MapMember<M extends RestMember> = M extends RestNamespaceDef
  ? { [K in M['name']]: InferRest<M['children']> }
  : M extends RestMemberDef
    ? {
        [K in M['name']]: RestMethodFn<
          NonNullable<M['args']>,
          Promise<InferRestRes<NonNullable<M['schema']>>>
        >;
      }
    : never;

type MapMembers<T extends readonly RestMember[]> = {
  [K in keyof T]: T[K] extends RestMember ? MapMember<T[K]> : never;
}[number]; // Union of mapped members

type MergeUnion<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void
  ? { [K in keyof I]: I[K] }
  : never;

export type InferRest<T extends readonly RestMember[]> = MergeUnion<MapMembers<T>>;

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

// 🔧 Recursive function builder
function buildFromMembers(
  basePath: string,
  members: Readonly<RestMember[]>,
  options: RestOptions
): Record<string, object> {
  const obj: Record<string, object> = {};

  for (const member of members) {
    if ('children' in member) {
      obj[member.name] = buildFromMembers(urlJoin(basePath, member.name), member.children, options);
    } else {
      obj[member.name] = (
        args: Record<string, string | number | boolean> = {},
        init: HttpRequestInit = {}
      ) => {
        const noBody = member.method === 'GET' || member.method === 'DELETE';
        const finalArgs = { ...(member.args || {}), ...args };
        const urlPath = options.substituteRootParams(urlJoin(basePath, member.path), finalArgs);
        const finalConfig = { ...(member.config || {}), ...(init.config || {}) };
        const finalUrl = noBody ? `${urlPath}?${options.parseArgs(finalArgs)}` : urlPath;
        const data = noBody ? null : finalArgs;
        const fetchInit: HttpRequestInit = {
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

export function rest(restOptions: Partial<RestOptions>) {
  const opts: RestOptions = {
    baseUrl: restOptions.baseUrl ?? document.baseURI ?? '/',
    http: restOptions.http ?? http.default(),
    parseArgs: restOptions.parseArgs ?? defaultParseQuery,
    substituteRootParams:
      restOptions.substituteRootParams ??
      ((path, args) => path.replace(/:([^/]+)/g, (_, key: string) => encodeURIComponent(args[key])))
  };

  return <T extends readonly RestMember[]>(
    path: string,
    define: (fn: typeof createFunctions) => T
  ): InferRest<T> => {
    const members = define(createFunctions);
    return buildFromMembers(urlJoin(opts.baseUrl, path), members, opts) as InferRest<T>;
  };
}
