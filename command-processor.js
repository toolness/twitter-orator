function CommandProcessor(rootDir) {
  var self = {};

  self.execute = function(cmdline, cb) {
    return cb("Unrecognized command.");
  };

  return self;
}

module.exports = CommandProcessor;

if (!module.parent)
  CommandProcessor(__dirname + '/commands')
    .execute(process.argv[2] || '', console.log.bind(console));
