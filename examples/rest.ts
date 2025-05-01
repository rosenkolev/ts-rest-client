import rest from '../src';

const api = rest({
  baseUrl: 'https://api.restful-api.dev/'
});

const obj = api('objects', ({ get }) => {
  get('all', { path: '/' });
});

const data = obj.all();
