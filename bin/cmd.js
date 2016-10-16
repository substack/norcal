#!/usr/bin/env node

var minimist = require('minimist')
var path = require('path')
var homedir = require('os-homedir')
var norcal = require('../')
var hyperlog = require('hyperlog')
var level = require('level')
var mkdirp = require('mkdirp')
var calmonth = require('calendar-month-string')
var layers = require('text-layers')
var fcolor = require('fuzzy-ansi-color')
var strftime = require('strftime')
var has = require('has')
var fs = require('fs')
var path = require('path')

var reset = fcolor('reset')
var soft = '\x1b[27m'

var xcolors = [
  'cyan', 'lime', 'orange', 'magenta',
  'yellow', 'red', 'blue', 'violet'
]

var argv = minimist(process.argv.slice(2), {
  alias: {
    h: 'help',
    d: 'datadir',
    m: ['msg','message'],
    v: 'value',
    t: 'title'
  },
  default: {
    datadir: path.join(homedir(), '.norcal'),
    created: new Date
  }
})
if (argv.help || argv._[0] === 'help') {
  return usage(0)
}

mkdirp.sync(argv.datadir)

var db = {
  log: level(path.join(argv.datadir, 'log.db')),
  index: level(path.join(argv.datadir, 'index.db'))
}
var cal = norcal({
  log: hyperlog(db.log, { valueEncoding: 'json' }),
  db: db.index
})

if (argv._[0] === 'add') {
  var value = { title: argv.title }
  var opts = { created: argv.created, value: value }
  cal.add(argv._.splice(1).join(' '), opts, function (err, node) {
    if (!err && node) {
      var title = node.value.v.value.title
      console.error('[' + node.value.k + '] Added "' + title + '": ' + node.value.v.time + '.')
    }
    if (err) exit(err)
  })
} else if (argv._[0] === 'query') {
  var opts = monthRange(new Date)
  cal.query(opts).on('data', function (row) {
    console.log(row)
  })
} else if (argv._[0] === 'rm') {
  cal.remove(argv._[1], function (err) {
    if (err) exit(err)
  })
} else {
  var date = new Date
  cal.query(monthRange(date), function (err, docs) {
    if (err) return exit(err)
    var colors = {}
    var titles = {}
    var times = {}
    var index = 0
    var indexes = {}
    var keys = []
    docs.forEach(function (doc) {
      if (!has(indexes,doc.key)) {
        indexes[doc.key] = index++
        keys.push(doc.key)
      }
    })
    colors[date.getDate()] = 'reverse'
    docs.forEach(function (doc) {
      var d = doc.time.getDate()
      var i = indexes[doc.key]
      var c = 'bright ' + xcolors[i%xcolors.length]
      colors[d] = date.getDate() === d ? 'reverse ' + c : c
      titles[doc.key] = doc.value.title
      times[doc.key] = strftime('%a %e %H:%M', doc.time)
    })
    var caltxt = calmonth(new Date, { colors: colors })
    var evlines = keys.map(function (key) {
      var c = 'bright ' + xcolors[indexes[key]%xcolors.length]
      return fcolor(c) + '[' + key + '] '
        + times[key] + reset + ' ' + titles[key]
    })
    console.log(layers([
      { text: caltxt, x: 0, y: 0 },
      { text: evlines.join('\n'), x: 22, y: 1 }
    ]))
  })
}

function exit (err) {
  console.error(err.message)
  process.exit(1)
}

function monthRange (date) {
  var first = new Date(date)
  first.setHours(0)
  first.setMinutes(0)
  first.setSeconds(0)
  first.setDate(1)
  var last = new Date(date)
  last.setHours(0)
  last.setMinutes(0)
  last.setSeconds(0)
  last.setMonth(date.getMonth()+1)
  last.setDate(1)
  return { gt: first, lt: last }
}

function usage (code) {
  var r = fs.createReadStream(path.join(__dirname, 'usage.txt'))
  if (code) r.once('end', function () { process.exit(code) })
  r.pipe(process.stdout)
}
