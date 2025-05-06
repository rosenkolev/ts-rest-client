# typed-rest-api-client [beta-release]

[![npm latest version](https://img.shields.io/npm/v/typed-rest-api-client/latest?logo=npm)](https://www.npmjs.com/package/typed-rest-api-client)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/typed-rest-api-client?label=npm%20-%20minzipped&logo=npm)](https://www.npmjs.com/package/typed-rest-api-client)
[![npm license](https://img.shields.io/npm/l/typed-rest-api-client)](https://github.com/rosenkolev/typed-rest-api-client/blob/master)
[![build](https://github.com/typed-rest-api-client/workflows/pipeline/badge.svg)](https://github.com/rosenkolev/typed-rest-api-client/actions?query=workflow%3Apipeline)

**Flexible, Type-Safe REST Client Generator for JavaScript & TypeScript**

`typed-rest-api-client` is a lightweight utility for defining and consuming RESTful APIs using declarative, namespaced syntax. It supports interceptors, argument substitution, and works in both **Node.js** and **browser** environments.

---

## ✨ Features

- 🧠 **Type-safe** endpoint definitions with full TypeScript support
- 🧩 **Composable API** structure with namespace support
- 🔄 **Request/response interceptors** for parsing, logging, authentication, etc.
- 🌐 Compatible with **browser** and **Node.js** environments
- 🔄 Supports both **CommonJS** and **ESM** module formats
- 🤝 Works with popular libraries like **axios**
- 📦 **Small bundle size** for efficient builds

---

## 📦 Installation

```bash
npm install typed-rest-api-client
```

## 🚀 Getting Started

```typescript
import { rest } from 'typed-rest-api-client';

const api = rest({
  baseUrl: 'https://api.no-domain/'
});

const users = api('users', ({ get, post, namespace }) => [
  get('about'),

  get('all', {
    path: '/',
    args: { limit: 100 } as {
      limit?: number;
      skip?: number;
      take?: number;
    },
    response: null as { name: string }[],
    config: { test: 'Print me in http' }
  }),

  get('findOne', {
    path: '/:id'
  }),

  post('create', {
    path: '/:id'
  }),

  namespace('students', ({ get, post, put, del }) => [
    post('create', { path: '/' }),
    get('get', { path: '/:id', args: {} as { id: number } }),
    put('update', { path: '/:id' }),
    del('delete', { path: '/:id', args: {} as { id: number } })
  ])
]);

// calls: https://api.no-domain/users?skip=0&limit=100
// and `res` is object of type `{ name: string }[]`
const res = await users.all({ skip: 0 }); 

users.about();
users.findOne({ id: 42 });
users.students.get({ id: 5 });
users.students.update({ id: 5, name: 'Test' });
users.students.delete({ id: 5 });
```

## ⚙️ Http client

A simple build in http client with interceptors functionality.

```typescript
import { http } from 'typed-rest-api-client';

const client = http();

// The same as:
const client = http((reqInfo, init) => fetch(reqInfo, init));
```

### Built-in interceptors:

```typescript
import { http, defaultJsonParser, defaultErrorCode } from 'typed-rest-api-client';

const client = http.default();

// The same as:
const client = http()
  .wrap(httpBodySerialize)
  .wrap(httpErrorCode)
  .wrap(httpJsonParser);
```

- **httpBodySerialize** - Serializes init.data to request.body using JSON.stringify (e.g. `client(url, { data: { a: 1 } })).
- **httpErrorCode** - When the request returns statusCode >= 400 throws and Error. 
- **httpJsonParser** - Parse response body as JSON object.

### Custom interceptor:

```typescript
import { interceptor } from 'typed-rest-api-client';

const logger = interceptor({
  preRequest: (req, config) => {
    console.log('Request:', req);
    return req;
  },
  postRequest: async (res, config) => {
    console.log('Response:', await res.clone().json());
    return res;
  }
});

const customClient = http().wrap(logger);
```

## Work with other libraries

### axios

```typescript
import axios from 'axios';
import { http } from 'typed-rest-api-client';

const api = rest({
  baseUrl: 'https://api.no-domain/',
  http: (reqInfo, init) => axios({
    method: init?.method ?? 'get',
    url: reqInfo as string,
    data: init?.data
  })
});

// ... use api
```

### Angular

```typescript
@Injectable()
class RestClient {
  readonly #http = inject(HttpClient);
  readonly #api = rest({
    http: (reqInfo, init) => this.#http(reqInfo as string, init.data)
  });
}
```

Using the `rest` client will return `Observable`.

### Zod

```typescript
import { z } from "zod";

const User = z.object({
  username: z.string(),
});

const users = rest()('users', ({ get  }) => [
  get('all', {
    response: (res) => User.parse(res)
  })
]);


const allUsers = await users.all(); // zod parse is applied
```

## 🧱 REST Structure

`rest(options)(rootPath, definition)`

**rest options:**

- `baseUrl: string`
- `http?: HttpHandler<object>`
- `parseArgs?: (args: Record<string, string | number | boolean>) => string`
- ` parseBody?: (data: unknown) => string`
- `substituteRootParams?: (path: string, args: Record<string, string | number | boolean>) => string`

**Creates a namespaced REST client:**

- `rootPath` –- path of the api resource
- `definition(fn)` –- Declaratively define methods and nested namespaces

### Endpoint Creators

- `get(name, config?)`
- `post(name, config?)`
- `put(name, config?)`
- `patch(name, config?)`
- `del(name, config?)`
- `namespace(name, defineFn)`

Each `config` object can include:

- `path` – route path (e.g. /:id)
- `args` – default argument types
- `config` – custom config passed to interceptors

## License

[MIT © Rosen Kolev](./LICENSE)
