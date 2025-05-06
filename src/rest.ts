import type { HttpHandler, HttpRequestInit } from './client';
import { http } from './client';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type HttpArgs = Record<string, string | number | boolean>;

export interface RestOptions<THttpRes> {
  baseUrl: string;
  http: HttpHandler<THttpRes>;
  parseArgs: (args: Record<string, string | number | boolean>) => string;
  substituteRootParams: (path: string, args: Record<string, string | number | boolean>) => string;
}

export interface RestMethodMemberDef<
  TArgs = Record<string, string | number | boolean>,
  TRes = unknown
> {
  path: string;
  args?: TArgs;
  response?: TRes | ((res: object) => TRes);
  config?: Record<string, unknown>;
}

export interface RestMemberDef<TArgs = Record<string, string | number | boolean>, TRes = unknown>
  extends RestMethodMemberDef<TArgs, TRes> {
  name: string;
  method: HttpMethod;
}

type InferResponse<T> = T extends { response: infer R }
  ? R extends (...args: unknown[]) => infer U
    ? U
    : R
  : never;

export interface RestNamespaceDef {
  name: string;
  children: RestMember[];
}

type RestMember = RestMemberDef | RestNamespaceDef;

export type RestMethodFn<TArgs extends HttpArgs, TRes = unknown> = (
  args?: TArgs,
  config?: HttpRequestInit
) => TRes;

type MapMember<M extends RestMember, THttpRes> = M extends RestNamespaceDef
  ? { [K in M['name']]: InferRest<M['children'], THttpRes> }
  : M extends RestMemberDef
    ? { [K in M['name']]: RestMethodFn<NonNullable<M['args']>, THttpRes> }
    : never;

type MapMembers<T extends readonly RestMember[], THttpRes> = {
  [K in keyof T]: T[K] extends RestMember ? MapMember<T[K], THttpRes> : never;
}[number]; // Union of mapped members

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MergeUnion<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? { [K in keyof I]: I[K] }
  : never;

export type InferRest<T extends readonly RestMember[], THttpRes> = MergeUnion<
  MapMembers<T, THttpRes>
>;

// Functions

const member = <T extends string, X extends HttpMethod, TArgs = HttpArgs>(
  name: T,
  method: X,
  opts?: RestMethodMemberDef<TArgs>
) => ({
  ...opts,
  path: opts?.path ?? `/${name}`,
  name,
  method,
  args: opts?.args
});

const bindMember =
  <X extends HttpMethod>(method: X) =>
  <T extends string, TArgs = HttpArgs>(name: T, config?: RestMethodMemberDef<TArgs>) =>
    member<T, X, TArgs>(name, method, config);

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
  options: RestOptions<unknown>
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
        const finalArgs = { ...(member.args || {}), ...args };
        const urlPath = options.substituteRootParams(urlJoin(basePath, member.path), finalArgs);
        const finalConfig = { ...(member.config || {}), ...(init.config || {}) };
        const finalUrl =
          member.method === 'GET' || member.method === 'DELETE'
            ? `${urlPath}?${options.parseArgs(finalArgs)}`
            : urlPath;

        const fetchInit: HttpRequestInit = {
          ...init,
          method: member.method,
          headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {})
          },
          config: finalConfig
        };

        return options.http(finalUrl, fetchInit);
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

export function rest<THttpRes = Promise<object>>(restOptions: Partial<RestOptions<THttpRes>>) {
  const opts: RestOptions<unknown> = {
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
  ): InferRest<T, THttpRes> => {
    const members = define(createFunctions);
    return buildFromMembers(urlJoin(opts.baseUrl, path), members, opts) as InferRest<T, THttpRes>;
  };
}
