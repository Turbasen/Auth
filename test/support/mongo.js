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

module.exports = new Mongo('mongodb://mongo:27017/test');
