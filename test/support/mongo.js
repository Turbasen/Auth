'use strict';

const EventEmitter = require('events').EventEmitter;
const MongoClient = require('mongodb').MongoClient;
const inherits = require('util').inherits;

const Mongo = function Mongo(uri) {
  EventEmitter.call(this);

  MongoClient.connect(uri, (err, database) => {
    if (err) { throw err; }

    this.db = database;
    this.users = database.collection('users');

    this.emit('ready');
  });

  return this;
};

inherits(Mongo, EventEmitter);

const addr = process.env.MONGO_PORT_27017_TCP_ADDR || 'mongo';
const port = process.env.MONGO_PORT_27017_TCP_PORT || '27017';
const db = 'test';

module.exports = new Mongo(`mongodb://${addr}:${port}/${db}`);
