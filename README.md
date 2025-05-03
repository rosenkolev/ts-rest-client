# rest-http-client

**Flexible, Type-Safe REST Client Generator for JavaScript & TypeScript**

`rest-http-client` is a lightweight utility for defining and consuming RESTful APIs using declarative, namespaced syntax. It supports interceptors, argument substitution, and works in both **Node.js** and **browser** environments.

---

## ✨ Features

- 🧠 **Type-safe endpoint definitions** with full TypeScript support
- 🧩 **Composable API structure** with `namespace` support
- 🔄 **Request/response interceptors** for parsing, logging, authentication, etc.
- 🌐 **Compatible with browser and Node.js** environments
- 🔧 **Customizable HTTP client and serializers**

---

## 📦 Installation

```bash
npm install rest-http-client
```

## 🚀 Getting Started

```typescript
import { rest } from 'rest-http-client';

const api = rest({
  baseUrl: 'https://api.no-domain/'
});

const users = api('users', ({ get, post, namespace }) => [
  get('about'),

  get('all', {
    path: '/',
    args: {
      limit: 100,
      skip: undefined,
      take: undefined
    },
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
    get('get', { path: '/:id', args: { id: 0 } }),
    put('update', { path: '/:id' }),
    del('delete', { path: '/:id', args: { id: 0 } })
  ])
]);

users.about();
users.all({ skip: 0 });
users.findOne({ id: 42 });
users.students.get({ id: 5 });
users.students.delete({ id: 5 });
```

## 🧱 REST API Structure

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

## ⚙️ Fetch wrapper with Interceptors

Use interceptors to wrap a HTTP `fetch` request with reusable behavior.

### Built-in interceptors:

```typescript
import { http, defaultJsonParser, defaultErrorCode } from 'rest-http-client';

const client = http()
  .wrap(defaultErrorCode)
  .wrap(defaultJsonParser);
```

### Custom interceptor:

```typescript
import { interceptor } from 'rest-http-client';

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

## Credit

Created by [rosenkolev](https://github.com/rosenkolev)
