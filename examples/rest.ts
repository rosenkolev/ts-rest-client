import { rest } from '../src';

const api = rest({
  baseUrl: 'https://api.no-domain/'
});

type Id<T = number> = { id: T };
type User = Id & { username: string };

const obj = api('users', ({ get, post, namespace }) => [
  get('about', { config: { errorCode: 400 } }),

  get('all', {
    path: '/',
    args: { limit: 100 } as {
      limit?: number;
      skip?: number;
      take?: number;
    },
    schema: null! as User[] | null,
    config: { test: 'Print me in http' }
  }),

  get('findOne', {
    path: '/:id',
    schema: (res) => /** zodSchema.parse(res) */ res as User
  }),

  post('create', { path: '/:id' }),

  // students
  namespace('students', ({ get, post, put, del }) => [
    post('create', { path: '/' }),
    get('get', { path: '/:id', args: {} as Id }),
    put('update', { path: '/:id' }),
    del('delete', { path: '/:id', args: {} as Id })
  ])
]);

const allUSers = await obj.all({
  skip: 0
});

const a = await obj.about(null, {
  config: {
    errorCode: 401
  }
});

const b = await obj.create({});
const one = await obj.findOne({ test: 'A' });

obj.students.get({ id: 5 });
obj.students.delete({ id: 5 });
