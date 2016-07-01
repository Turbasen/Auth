'use strict';

const mongo = require('./support/mongo');
const redis = require('./support/redis');
const users = require('./support/users');

before(done => mongo.on('ready', done));

beforeEach(done => redis.flushall(done));
beforeEach(done => mongo.users.drop(done));
beforeEach(done => mongo.users.insert(users, done));
