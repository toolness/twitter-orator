var EventEmitter = require('events').EventEmitter;
var should = require('should');

var say = require('../orator');
var sample = require('./sample-data');

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

describe('FriendTracker', function() {
  var FriendTracker = say.FriendTracker;

  it('tracks friends', function() {
    var s = new EventEmitter();
    var tracker = new FriendTracker(s, 'mozbrooklyn');

    s.emit('data', sample.FRIENDS);
    tracker.isFriend(9717342).should.be.true;
    tracker.isFriend('9717342').should.be.true;

    s.emit('data', sample.FOLLOW);
    tracker.isFriend(178796444).should.be.true;

    s.emit('data', sample.UNFOLLOW);
    tracker.isFriend(178796444).should.be.false;
  });
});

describe('Orator', function() {
  var Orator = say.Orator;
  var orator, says, stream, tracker;

  beforeEach(function() {
    tracker = {
      screenName: 'mozbrooklyn',
      isFriend: function() { return true; }
    };
    stream = new EventEmitter();
    orator = Orator(tracker, stream);
    says = [];
    orator.on('say', says.push.bind(says));
  });

  it('does not say direct messages from itself', function() {
    var dm = clone(sample.DM);
    dm.direct_message.sender = dm.direct_message.recipient;
    stream.emit('data', dm);
    says.should.eql([]);
  });

  it('says direct messages from friends', function() {
    stream.emit('data', sample.DM);
    says.should.eql(['direct message from toolness: this is a test']);
  });

  it('does not say mentions from self', function() {
    var mention = clone(sample.MENTION);
    mention.user = clone(sample.DM.direct_message.recipient);
    stream.emit('data', mention);
    says.should.eql([]);
  });

  it('says mentions from friends', function() {
    stream.emit('data', sample.MENTION);
    says.should.eql(['toolness says @mozbrooklyn this is a test!']);
  });

  it('ignores mentions from non-friends', function() {
    tracker.isFriend = function() { return false; };
    stream.emit('data', sample.MENTION);
    says.should.eql([]);
  });
});
