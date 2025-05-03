import { rest } from '../src';

const api = rest({
  baseUrl: 'https://api.no-domain/'
});

type Id<T = number> = { id: T };

const obj = api('users', ({ get, post, namespace }) => [
  get('about'),

  get('all', {
    path: '/',
    args: { limit: 100 } as {
      limit?: number;
      skip?: number;
      take?: number;
    },
    config: { test: 'Print me in http' }
  }),

  get('findOne', {
    path: '/:id'
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

obj.all({
  skip: 0
});

obj.about();

obj.findOne({ test: 'A' });

obj.students.get({ id: 5 });
obj.students.delete({ id: 5 });
