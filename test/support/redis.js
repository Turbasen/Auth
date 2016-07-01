'use strict';

const Redis = require('ioredis');

const addr = process.env.MONGO_PORT_27017_TCP_ADDR || 'redis';
const port = process.env.MONGO_PORT_27017_TCP_PORT || '6379';

module.exports = new Redis(port, addr);
