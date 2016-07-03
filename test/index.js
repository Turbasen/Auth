'use strict';

const mongo = require('@turbasen/db-mongo');
const redis = require('@turbasen/db-redis');
const users = require('@turbasen/test-data').api.users;

before(done => {
  if (mongo.db) { return done(); }
  return mongo.on('ready', done);
});

beforeEach(done => redis.flushall(done));
beforeEach(done => mongo.db.dropDatabase(done));
beforeEach(done => mongo.api.users.insert(users, done));
