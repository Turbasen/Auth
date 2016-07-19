'use strict';
/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */

const request = require('supertest');
let app;

before(() => {
  app = request(require('../../examples/server')); // eslint-disable-line global-require
});

describe('Acceptance Server', () => {
  it('accepts unauthenticated user', done => {
    app.get('/')
      .set('x-forwarded-for', '123.456.789')
      .expect(200)
      .expect('X-User-Auth', 'false')
      .expect('X-RateLimit-Limit', '100')
      .expect('X-RateLimit-Remaining', '99')
      .expect('X-RateLimit-Reset', /[0-9]{10}/)
      .expect('Hello guest (123.456.789)', done);
  });

  it('authenticates user with valid Authorization header', done => {
    app.get('/')
      .set('Authorization', 'Token foo_app1_test')
      .expect(200)
      .expect('X-User-Auth', 'true')
      .expect('X-User-Provider', 'FOO')
      .expect('X-RateLimit-Limit', '499')
      .expect('X-RateLimit-Remaining', '498')
      .expect('X-RateLimit-Reset', /[0-9]{10}/)
      .expect('Hello FOO (foo_app1)', done);
  });

  it('authenticates user with valid api_key query param', done => {
    app.get('/?api_key=foo_app1_test')
      .expect(200)
      .expect('X-User-Auth', 'true')
      .expect('X-User-Provider', 'FOO')
      .expect('X-RateLimit-Limit', '499')
      .expect('X-RateLimit-Remaining', '498')
      .expect('X-RateLimit-Reset', /[0-9]{10}/)
      .expect('Hello FOO (foo_app1)', done);
  });
});
