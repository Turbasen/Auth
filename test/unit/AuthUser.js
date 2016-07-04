'use strict';

const assert = require('assert');

const redis = require('@turbasen/db-redis');
const HttpError = require('@starefossen/http-error');
const AuthUser = require('../../lib/AuthUser');

describe('AuthUser', () => {
  let user;

  beforeEach(() => {
    user = new AuthUser('abc123', {
      provider: 'FOO',
      app: 'foo_app1',
      limit: 100,
      remaining: 100,
      reset: 123456789,
    });
  });

  describe('new', () => {
    it('returns new UnauthUser', () => assert(user instanceof AuthUser));
  });

  describe('user.type', () => {
    it('returns "token"', () => assert.equal(user.type, 'token'));
  });

  describe('user.auth', () => {
    it('returns true', () => assert.equal(user.auth, true));
  });

  describe('user.name', () => {
    it('returns name', () => assert.equal(user.name, 'FOO (foo_app1)'));
  });

  describe('user.isOwner()', () => {
    it('returns false when document tilbyder is undefined', () => {
      assert.equal(user.isOwner({}), false);
    });

    it('returns false when document tilbyder != user provider', () => {
      assert.equal(user.isOwner({ tilbyder: 'other' }), false);
    });

    it('returns true when document tilbyder = user provider', () => {
      assert.equal(user.isOwner({ tilbyder: 'FOO' }), true);
    });
  });

  describe('user.can()', () => {
    ['OPTIONS', 'HEAD', 'GET', 'POST', 'PUT', 'PATCH'].forEach(method => {
      it(`${method} returns true`, () => {
        assert.equal(user.can(method), true);
      });
    });
  });

  describe('user.query()', () => {
    it('returns query when query tilbyder is the user', () => {
      const query = { foo: 'bar', tilbyder: 'FOO' };
      assert.deepEqual(user.query(query), query);
    });

    it('sets status when query tilbyder is not the user', () => {
      const query = { foo: 'bar', tilbyder: 'other' };
      assert.deepEqual(user.query(query), {
        foo: 'bar',
        tilbyder: 'other',
        status: 'Offentlig',
      });
    });

    ['Offentlig', 'Slettet'].forEach(status => {
      it(`returns query when query status is ${status}`, () => {
        const query = { foo: 'bar', status };
        assert.deepEqual(user.query(query), query);
      });
    });

    ['Privat', 'Kladd', { $ne: 'Offentlig' }].forEach(status => {
      it(`sets tilbyder when query status is ${status.toString()}`, () => {
        const query = { foo: 'bar', status };
        assert.deepEqual(user.query(query), {
          foo: 'bar',
          status,
          tilbyder: 'FOO',
        });
      });
    });

    it('sets $or query when query is empty', () => {
      assert.deepEqual(user.query({}), {
        $or: [{ tilbyder: 'FOO' }, { status: 'Offentlig' }],
      });
    });

    it('sets $or query when status or tilbyder is not set', () => {
      assert.deepEqual(user.query({ foo: 'bar' }), {
        foo: 'bar',
        $or: [{ tilbyder: 'FOO' }, { status: 'Offentlig' }],
      });
    });
  });

  describe('AuthUser.getCacheKey()', () => {
    it('returns cache key for user', () => {
      assert.equal(AuthUser.getCacheKey('key'), 'api:token:key');
    });
  });

  describe('AuthUser.getFromMongo()', () => {
    it('resolves for valid user token', done => {
      AuthUser.getFromMongo('foo_app1_test').then(u => process.nextTick(() => {
        assert(u instanceof AuthUser);
        done();
      }));
    });

    it('rejects for invalid user token', done => {
      AuthUser.getFromMongo('invalid').catch(error => process.nextTick(() => {
        assert(error instanceof HttpError);
        done();
      }));
    });
  });

  describe('AuthUser.getByKey()', () => {
    it('rejects invalid token', done => {
      AuthUser.getByKey('invalid')
        .then(() => process.nextTick(() => assert.fail()))
        .catch(error => process.nextTick(() => {
          assert(error instanceof HttpError);
          assert.equal(error.code, 401);
          assert.equal(error.message, 'Bad credentials for user "invalid"');
          done();
        }));
    });

    it('saves invalid token to redis cache', done => {
      AuthUser.getByKey('invalid')
        .then(() => process.nextTick(() => assert.fail()))
        .catch(() => process.nextTick(() => {
          redis.hgetall('api:token:invalid', (err, data) => {
            assert.ifError(err);
            assert.deepEqual(data, { access: 'false' });
            done();
          });
        }));
    });

    it('caches invalid token for 24 hours', done => {
      AuthUser.getByKey('invalid')
        .then(() => process.nextTick(() => assert.fail()))
        .catch(() => process.nextTick(() => {
          redis.ttl('api:token:invalid', (err, ttl) => {
            assert.ifError(err);
            assert(ttl >= 86390 && ttl <= 86410); // 24h ± 10s
            done();
          });
        }));
    });

    it('rejects invalid token from redis cache', done => {
      redis.hset('api:token:invalid', 'access', 'false', err => {
        assert.ifError(err);

        AuthUser.getByKey('invalid')
          .then(() => process.nextTick(() => assert.fail()))
          .catch(error => process.nextTick(() => {
            assert.equal(error.code, 401);
            assert.equal(error.message, 'Bad credentials for user "invalid"');

            done();
          }));
      });
    });

    it('returns user for valid token', done => {
      AuthUser.getByKey('foo_app1_test')
        .then(u => process.nextTick(() => {
          assert(u instanceof AuthUser);

          assert.equal(u.key, 'foo_app1_test');
          assert.equal(u.provider, 'FOO');
          assert.equal(u.app, 'foo_app1');
          assert.equal(u.limit, 499);
          assert.equal(u.remaining, 499);

          const expire = Math.floor(new Date().getTime() / 1000);
          assert(u.reset > expire);

          assert.equal(u.penalty, 0);

          done();
        }))
        .catch(error => process.nextTick(() => done(error)));
    });

    it('saves valid token to redis chache', done => {
      AuthUser.getByKey('foo_app1_test')
        .then(() => process.nextTick(() => {
          redis.hgetall('api:token:foo_app1_test', (err, data) => {
            assert.ifError(err);
            assert.deepEqual(data, {
              access: 'true',
              app: 'foo_app1',
              limit: '499',
              provider: 'FOO',
              remaining: '499',
              reset: data.reset,
            });

            const expire = Math.floor(new Date().getTime() / 1000);
            assert(parseInt(data.reset, 10) > expire);

            done();
          });
        }))
        .catch(() => process.nextTick(() => assert.fail()));
    });

    it('caches valid token for 1 hour', done => {
      AuthUser.getByKey('foo_app1_test')
        .then(() => process.nextTick(() => {
          redis.ttl('api:token:foo_app1_test', (err, ttl) => {
            assert.ifError(err);
            assert(ttl >= 3590 && ttl <= 3610); // 24h ± 10s
            done();
          });
        }))
        .catch(() => process.nextTick(() => assert.fail()));
    });

    it('returns user for cached valid token', done => {
      redis.hmset('api:token:valid', {
        access: 'true',
        app: 'test_app',
        limit: '123',
        provider: 'TEST',
        remaining: '99',
        reset: '9999999999',
      });

      AuthUser.getByKey('valid')
        .then(u => process.nextTick(() => {
          assert(u instanceof AuthUser);
          done();
        }))
        .catch(() => process.nextTick(() => assert.fail()));
    });
  });
});
