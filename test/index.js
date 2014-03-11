var EventEmitter = require('events').EventEmitter;
var Readable = require('stream').Readable;
var should = require('should');

var say = require('../orator');
var sample = require('./sample-data');

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function pipeIntoAndExpect(target, items, expectation, done) {
  var allData = [];
  var stream = new Readable({objectMode: true});

  items.forEach(function(data) { stream.push(data); });
  stream.push(null);
  stream.pipe(target).on('data', function(data) {
    allData.push(data);
  }).on('end', function() {
    allData.should.eql(expectation);
    done();
  });    
}

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

describe('FriendDmAndMentionFilter', function() {
  var FriendDmAndMentionFilter = say.FriendDmAndMentionFilter;
  var filter, tracker, pipeAndExpect;

  beforeEach(function() {
    tracker = {
      screenName: 'mozbrooklyn',
      isFriend: function() { return true; }
    };
    filter = FriendDmAndMentionFilter(tracker);
    pipeAndExpect = pipeIntoAndExpect.bind(null, filter);
  });

  it('ignores direct messages from itself', function(done) {
    var dm = clone(sample.DM);
    dm.direct_message.sender = dm.direct_message.recipient;
    pipeAndExpect([dm], [], done);
  });

  it('keeps direct messages from friends', function(done) {
    pipeAndExpect([sample.DM], [sample.DM], done);
  });

  it('ignores mentions from self', function(done) {
    var mention = clone(sample.MENTION);
    mention.user = clone(sample.DM.direct_message.recipient);
    pipeAndExpect([mention], [], done);
  });

  it('keeps mentions from friends', function(done) {
    pipeAndExpect([sample.MENTION], [sample.MENTION], done);
  });

  it('ignores mentions from non-friends', function(done) {
    tracker.isFriend = function() { return false; };
    pipeAndExpect([sample.MENTION], [], done);
  });
});

describe('Orator', function() {
  var Orator = say.Orator;

  it('should process direct messages', function(done) {
    pipeIntoAndExpect(Orator(), [sample.DM], [
      'direct message from toolness: this is a test'
    ], done);
  });

  it('should process tweets', function(done) {
    pipeIntoAndExpect(Orator(), [sample.MENTION], [
      'toolness says @mozbrooklyn this is a test!'
    ], done);
  });

  it('should ignore everything else', function(done) {
    pipeIntoAndExpect(Orator(), [{lol: 'cat'}], [], done);
  });  
});
