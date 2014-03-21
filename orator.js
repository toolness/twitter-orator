var EventEmitter = require('events').EventEmitter;
var Writable = require('stream').Writable;
var exec = require('child_process').exec;
var through = require('through');
var twitter = require('./twitter');
var CommandProcessor = require('command-processor');

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

function FriendDmAndMentionFilter(friendTracker) {
  return through(function(data) {
    var screenName = friendTracker.screenName;

    if (!data || typeof(data) != 'object') return;
    if (data.direct_message && typeof(data.direct_message == 'object') &&
        data.direct_message.sender &&
        data.direct_message.sender.screen_name != screenName)
      return this.queue(data);
    if (data.text && typeof(data.text) == 'string' &&
        data.user && data.user.id && friendTracker.isFriend(data.user.id) &&
        data.user.screen_name &&
        data.user.screen_name != screenName &&
        data.entities && Array.isArray(data.entities.user_mentions) &&
        data.entities.user_mentions.filter(mentionsOf(screenName)).length)
      return this.queue(data);
  });
}

function Orator() {
  return through(function(data) {
    var dm = data.direct_message;
    var msg;

    if (dm)
      msg = 'direct message from ' + dm.sender.screen_name + ": " + dm.text;
    else if (data.text && data.user)
      msg = data.user.screen_name + ' says ' + data.text;

    if (msg)
      this.queue(msg);
  });
}

function TextToSpeech(sayPath) {
  var self = new Writable();

  self._write = function(chunk, encoding, cb) {
    var s = exec(sayPath, function(err) {
      if (err) return cb(err);
      self.emit('spoke', chunk);
      cb();
    });
    s.stdin.end(chunk, encoding);
  };

  return self;
}

exports.FriendDmAndMentionFilter = FriendDmAndMentionFilter;
exports.Orator = Orator;
exports.FriendTracker = FriendTracker;

function main() {
  var twit = new twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  });
  var userStream = twit.streamUser();
  var friendTracker = FriendTracker(userStream, process.env.SCREEN_NAME);
  var tts = TextToSpeech(process.env.SAY_CMD || '/usr/bin/say -f -');

  if ('DEBUG' in process.env)
    userStream.on('data', function(obj) {
      console.log('received object', obj);
    }).on('keepalive', function() {
      console.log('received keepalive');
    });

  userStream
    .pipe(FriendDmAndMentionFilter(friendTracker))
    .pipe(CommandProcessor(__dirname + '/commands'))
    .pipe(Orator())
    .pipe(tts).on('spoke', function(msg) {
      console.log("Done saying", JSON.stringify(msg.toString()));
    });

  console.log("Twitter stream initialized.");
  if (process.env.TEST_SAY) {
    tts.write("Yo yo this is " + friendTracker.screenName + "!");
    tts.write("I am ready to rock.");
  }
}

if (!module.parent) main();
