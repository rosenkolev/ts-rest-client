import { RestOptions, rest } from './rest';
import { http, defaultErrorCode, defaultJsonParser } from './client';

function defaultParseQuery(args: Record<string, string | number | boolean>) {
  return Object.entries(args)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export default function createRestClient(restOptions: Partial<RestOptions>) {
  return rest({
    baseUrl: restOptions.baseUrl ?? document.baseURI ?? '/',
    parseArgs: restOptions.parseArgs ?? defaultParseQuery,
    http: restOptions.http ?? http().wrap(defaultErrorCode).wrap(defaultJsonParser)
  });
}
