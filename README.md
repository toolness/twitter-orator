This is a tiny app to say aloud things tweeted at a user by
users they follow.

## Quick Start

First run `npm install` and `npm test`.

Then create a Twitter account that you want people to tweet at.

Then visit apps.twitter.com and create a new app. Also generate an
access token.

Then define some environment variables:

```
export SAY_CMD='/usr/bin/say -f -'
export SCREEN_NAME='mozbrooklyn'
export CONSUMER_KEY='xxxxxxxx'
export CONSUMER_SECRET='xxxxxxxx'
export ACCESS_TOKEN_KEY='xxxxxxxx'
export ACCESS_TOKEN_SECRET='xxxxxxxx'
```

Then run `node orator.js` and try tweeting at the user identified
by `SCREEN_NAME`, either via a public tweet or a direct message.
Make sure that `SCREEN_NAME` is following the tweeter, or else the
tweet will be ignored.
