import type { HttpClient, HttpRequestInit } from './client';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RestOptions {
  baseUrl: string;
  http: HttpClient<object>;
  parseArgs: (args: Record<string, string | number | boolean>) => string;
}

export interface MemberDef {
  name: string;
  path: string;
  method: HttpMethod;
  config?: Record<string, unknown>;
}

export type MethodMemberDef = Partial<Omit<MemberDef, 'name' | 'method'>>;
export type RestMethod = <T>(
  args: Record<string, string | number | boolean>,
  config: HttpRequestInit
) => T;

function substituteParams(
  path: string,
  args: Record<string, string | number | boolean>
): [string, Record<string, string | number | boolean>] {
  let result = path;
  const rest = { ...args };

  result = result.replace(/:([^/]+)/g, (_, key: string) => {
    const val = rest[key];
    delete rest[key];
    return encodeURIComponent(val);
  });

  return [result, rest];
}

const toMemberDef = (name: string, method: HttpMethod, opts?: MethodMemberDef): MemberDef => ({
  ...opts,
  path: opts?.path ?? `/${name}`,
  name,
  method
});

export class Namespace {
  protected members: MemberDef[] = [];
  protected children: Record<string, Namespace> = {};
  protected parentPath: string;

  constructor(parentPath: string) {
    this.parentPath = parentPath;
  }

  member(opts: MemberDef) {
    this.members.push(opts);
  }

  get(name: string, config?: MethodMemberDef) {
    this.member(toMemberDef(name, 'GET', config));
  }

  post(name: string, config?: MethodMemberDef) {
    this.member(toMemberDef(name, 'POST', config));
  }

  patch(name: string, config?: MethodMemberDef) {
    this.member(toMemberDef(name, 'PATCH', config));
  }

  put(name: string, config?: MethodMemberDef) {
    this.member(toMemberDef(name, 'PUT', config));
  }

  delete(name: string, config?: MethodMemberDef) {
    this.member(toMemberDef(name, 'DELETE', config));
  }

  namespace(name: string, define: (ns: Namespace) => void) {
    const child = new Namespace(`${this.parentPath}/${name}`);
    define(child);
    this.children[name] = child;
  }

  build(ops: Required<RestOptions>): Record<string, object> {
    const result: Record<string, object> = {};

    for (const m of this.members) {
      result[m.name] = <T>(
        args: Record<string, string | number | boolean> = {},
        config: HttpRequestInit = {}
      ) => {
        const [urlPath, rest] = substituteParams(`${ops.baseUrl}${this.parentPath}${m.path}`, args);

        const finalConfig: HttpRequestInit = {
          ...config,
          config: { ...(m.config || {}), ...(config.config || {}) }
        };

        if (m.method === 'GET') {
          const qs = ops.parseArgs(rest);
          const finalUrl = qs ? `${urlPath}?${qs}` : urlPath;
          return ops.http(finalUrl, { method: m.method, ...finalConfig }) as T;
        } else {
          return ops.http(urlPath, {
            method: m.method,
            headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
            body: JSON.stringify(rest),
            ...finalConfig
          }) as TestCoverage;
        }
      };
    }

    for (const [name, child] of Object.entries(this.children)) {
      result[name] = child.build(ops);
    }

    return result;
  }
}

export function rest(options: RestOptions) {
  return (path: string, define: (r: Namespace) => void) => {
    const root = new Namespace(`/${path}`);
    define(root);
    return root.build(options);
  };
}
