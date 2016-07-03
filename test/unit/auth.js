'use strict';

const HttpError = require('@starefossen/http-error');
const assert = require('assert');
const sinon = require('sinon');
const auth = require('../../');

const mongo = require('@turbasen/db-mongo');
const redis = require('@turbasen/db-redis');

const AuthUser = require('../../lib/User').AuthUser;
const UnauthUser = require('../../lib/User').UnauthUser;

describe('auth', () => {
  describe('getUserByToken()', () => {
    it('rejects invalid token', done => {
      auth.getUserByToken('invalid')
        .then(() => process.nextTick(() => assert.fail()))
        .catch(error => process.nextTick(() => {
          assert(error instanceof HttpError);
          assert.equal(error.code, 401);
          assert.equal(error.message, 'Bad credentials for user "invalid"');
          done();
        }));
    });

    it('saves invalid token to redis cache', done => {
      auth.getUserByToken('invalid')
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
      auth.getUserByToken('invalid')
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

        auth.getUserByToken('invalid')
          .then(() => process.nextTick(() => assert.fail()))
          .catch(error => process.nextTick(() => {
            assert.equal(error.code, 401);
            assert.equal(error.message, 'Bad credentials for user "invalid"');

            done();
          }));
      });
    });

    it('returns user for valid token', done => {
      auth.getUserByToken('foo_app1_test')
        .then(user => process.nextTick(() => {
          assert(user instanceof AuthUser);

          assert.equal(user.key, 'foo_app1_test');
          assert.equal(user.provider, 'FOO');
          assert.equal(user.app, 'foo_app1');
          assert.equal(user.limit, 499);
          assert.equal(user.remaining, 499);

          const expire = Math.floor(new Date().getTime() / 1000);
          assert(user.reset > expire);

          assert.equal(user.penalty, 0);

          done();
        }))
        .catch(error => process.nextTick(() => done(error)));
    });

    it('saves valid token to redis chache', done => {
      auth.getUserByToken('foo_app1_test')
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
      auth.getUserByToken('foo_app1_test')
        .then(() => process.nextTick(() => {
          redis.ttl('api:token:foo_app1_test', (err, ttl) => {
            assert.ifError(err);
            assert(ttl >= 3590 && ttl <= 3610); // 24h ± 10s
            done();
          });
        }))
        .catch(() => process.nextTick(() => assert.fail()));
    });

    it('returns user for cached valid token');
  });

  describe('getUserByIp()', () => {

  });

  describe('middleware', () => {
    let middleware;
    let getUserByIp;
    let getUserByToken;
    let req;
    let res;

    before(() => {
      getUserByIp = auth.getUserByIp;
      getUserByToken = auth.getUserByToken;
    });

    after(() => {
      auth.getUserByIp = getUserByIp;
      auth.getUserByToken = getUserByToken;
    });

    beforeEach(() => {
      req = {
        method: 'GET',
        connection: {},
        headers: {},
        query: {},
      };

      res = {
        set: () => { throw new Error('res.set() not implemented'); },
        on: () => { throw new Error('res.set() not implemented'); },
      };

      middleware = auth({ mongo: mongo.users, redis, env: 'prod' });

      auth.getUserByIp = () => {
        throw new Error('getUserByIp() not implemented');
      };

      auth.getUserByToken = () => {
        throw new Error('getUserByToken() not implemented');
      };
    });

    it('throws error for missing mongo option');
    it('throws error for missing redis option');

    it('returns middleware function', () => {
      assert.equal(typeof middleware, 'function');
    });

    it('looks up user by Authorization header', done => {
      req.headers.authorization = 'Token abc123';
      auth.getUserByToken = (token) => {
        assert.equal(token, 'abc123');
        done();

        return new Promise(() => {});
      };

      middleware(req, res, assert.fail.bind(assert));
    });

    it('looks up user by URL query parameter', done => {
      req.query.api_key = 'abc123';
      auth.getUserByToken = (token) => {
        assert.equal(token, 'abc123');
        done();

        return new Promise(() => {});
      };

      middleware(req, res, assert.fail.bind(assert));
    });

    it('looks up user by remote IP', done => {
      req.connection.remoteAddres = '123.456.789';
      auth.getUserByIp = (token) => {
        assert.equal(token, '123.456.789');
        done();

        return new Promise(() => {});
      };

      middleware(req, res, assert.fail.bind(assert));
    });

    it('looks up user by X-Forwarded-For header', done => {
      req.connection.remoteAddres = '127.0.0.1';
      req.headers['x-forwarded-for'] = '123.456.789';

      auth.getUserByIp = (token) => {
        assert.equal(token, '123.456.789');
        done();

        return new Promise(() => {});
      };

      middleware(req, res, assert.fail.bind(assert));
    });

    it('sets X-RateLimit headers for valid user', done => {
      req.connection.remoteAddres = '127.0.0.1';
      auth.getUserByIp = (token) => Promise.resolve(
        new UnauthUser(token, {
          limit: 100,
          remaining: 49,
          reset: 123456789,
        })
      );

      res.set = sinon.spy();
      res.on = sinon.spy();

      middleware(req, res, err => process.nextTick(() => {
        assert.ifError(err);

        assert(res.set.withArgs('X-RateLimit-Limit', 100).calledOnce);
        assert(res.set.withArgs('X-RateLimit-Remaining', 48).calledOnce);
        assert(res.set.withArgs('X-RateLimit-Reset', 123456789).calledOnce);

        done();
      }));
    });
  });
});
