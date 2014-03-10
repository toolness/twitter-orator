var split = require('split');
var through = require('through');
var OAuth = require('oauth');

// Much of the following code is based on recommendations mentioned here:
//
//   https://dev.twitter.com/docs/streaming-apis/connecting
//   https://dev.twitter.com/docs/streaming-apis/processing

var DISCONNECT_TIMEOUT_MS = 90000;

function Twitter(options) {
  this.options = options;
  this.oauth = new OAuth.OAuth(
    'https://api.twitter.com/oauth/request_token',
    'https://api.twitter.com/oauth/access_token',
    options.consumer_key,
    options.consumer_secret,
    '1.0A',
    null,
    'HMAC-SHA1'
  );
};

Twitter.prototype = {
  streamUser: function(cb) {
    var req = this.oauth.get(
      'https://userstream.twitter.com/1.1/user.json',
      this.options.access_token_key,
      this.options.access_token_secret
    );
    var disconnectTimeout;
    var resetDisconnectTimeout = function() {
      clearTimeout(disconnectTimeout);
      disconnectTimeout = setTimeout(function() {
        req.abort();
      }, DISCONNECT_TIMEOUT_MS);
    };
    var splitStream = split(/\r\n/);
    var objectStream = through(function(data) {
      data.length ? this.queue(JSON.parse(data)) : this.emit('keepalive');
    });

    splitStream.on('data', resetDisconnectTimeout);
    resetDisconnectTimeout();
    req.on('response', function(res) {
      if (res.statusCode != 200)
        return objectStream.emit('error',
                                 new Error('HTTP ' + res.statusCode));
      res.pipe(splitStream).pipe(objectStream);
    });
    req.on('error', function(err) { objectStream.emit('error', err); });
    req.end();

    return objectStream;
  },
  directMessage: function(screen_name, text, cb) {
    var req = this.oauth.post(
      'https://api.twitter.com/1.1/direct_messages/new.json',
      this.options.access_token_key,
      this.options.access_token_secret, {
        screen_name: screen_name,
        text: text
      }
    );
    req.on('response', function(res) {
      if (res.statusCode != 200)
        return cb(new Error('got status code ' + res.statusCode));
      cb(null, res);
    });
    req.on('error', cb);
    req.end();
  }
};

module.exports = Twitter;
