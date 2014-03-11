var EventEmitter = require('events').EventEmitter;
var exec = require('child_process').exec;
var async = require('async');
var twitter = require('./twitter');

function FriendTracker(stream, screenName) {
  var friends = {};
  var self = {
    screenName: screenName,
    isFriend: function(id) {
      return parseInt(id) in friends;
    },
    setFriends: function(friendList) {
      friends = {};
      friendList.forEach(function(id) {
        friends[id] = true;
      });
    }
  };

  if (!screenName) throw new Error('screen name required');
  stream.on('data', function(data) {
    if (!data || typeof(data) != 'object') return;
    if (Array.isArray(data.friends)) return self.setFriends(data.friends);
    if ((data.event == 'follow' || data.event == 'unfollow') &&
        data.source && data.source.screen_name == screenName &&
        data.target && typeof(data.target.id) == 'number') {
      if (data.event == 'follow')
        friends[data.target.id] = true;
      else
        delete friends[data.target.id];
    }
  });

  return self;
}

function mentionsOf(screenName) {
  return function(mention) {
    return mention.screen_name == screenName;
  }
}

function Orator(friendTracker, stream) {
  var self = new EventEmitter();

  function emitDirectMessage(dm) {
    self.emit('say', 'direct message from ' + dm.sender.screen_name + ": " +
              dm.text);
  }

  function emitMention(mention) {
    self.emit('say', mention.user.screen_name + ' says ' + mention.text);
  }

  stream.on('data', function(data) {
    var screenName = friendTracker.screenName;

    if (!data || typeof(data) != 'object') return;
    if (data.direct_message && typeof(data.direct_message == 'object') &&
        data.direct_message.sender &&
        data.direct_message.sender.screen_name != screenName)
      return emitDirectMessage(data.direct_message);
    if (data.text && typeof(data.text) == 'string' &&
        data.user && data.user.id && friendTracker.isFriend(data.user.id) &&
        data.user.screen_name &&
        data.user.screen_name != screenName &&
        data.entities && Array.isArray(data.entities.user_mentions) &&
        data.entities.user_mentions.filter(mentionsOf(screenName)).length)
      return emitMention(data);
  });

  return self;
}

exports.Orator = Orator;
exports.FriendTracker = FriendTracker;

function main() {
  var sayPath = process.env.SAY_CMD || '/usr/bin/say -f -';
  var queue = async.queue(function sayIt(msg, cb) {
    var s = exec(sayPath, cb);
    s.stdin.end(msg);
  }, 1);
  var say = function(msg) {
    queue.push(msg, function(err) {
      console.log("Done saying", JSON.stringify(msg));
      if (err) console.err(err);
    });
  };
  var twit = new twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  });
  var stream = twit.streamUser();
  var friendTracker = FriendTracker(stream, process.env.SCREEN_NAME);
  var orator = Orator(friendTracker, stream);

  if ('DEBUG' in process.env)
    stream.on('data', function(obj) {
      console.log('received object', obj);
    }).on('keepalive', function() {
      console.log('received keepalive');
    });

  orator.on('say', say);

  console.log("Twitter stream initialized.");
  if (process.env.TEST_SAY) {
    say("Yo yo this is " + friendTracker.screenName + "!");
    say("I am ready to rock.");
  }
}

if (!module.parent) main();
