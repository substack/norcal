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
var uniq = require('uniq')

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
  var key = argv._[1]

  getDocFromAbbreviation(key, function (err, doc) {
    if (err) return exit(err)
    cal.remove(doc.key, function (err) {
      if (err) exit(err)
    })
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

    // Determine the minimum key substring to show
    var shortKeys = abbreviate(uniq(Object.keys(docs).map(function (name) {
      return docs[name].key
    })))
    Object.keys(shortKeys).forEach(function (name, idx) {
      docs[idx].shortKey = shortKeys[name]
    })

    // Accumulate all event keys
    docs.forEach(function (doc) {
      if (!has(indexes,doc.key)) {
        indexes[doc.key] = index++
        keys.push({
          key: doc.key,
          day: Number(strftime('%e', doc.time))
        })
      }
    })

    function colorForDate (today, date) {
      var day = strftime('%w', date)
      var colour = 'bright ' + xcolors[day % xcolors.length]
      if (today.getDate() === date.getDate()) {
        return 'reverse'
      } else {
        return 'bright ' + colour
      }
    }

    colors[date.getDate()] = 'reverse'
    docs.forEach(function (doc) {
      var d = Number(strftime('%e', doc.time))
      var i = indexes[doc.key]
      colors[d] = colorForDate(date, doc.time)
      titles[doc.key] = doc.value.title
      times[doc.key] = strftime('%a %b %e %H:%M', doc.time)
    })
    var caltxt = calmonth(new Date, { colors: colors })
    var evlines = docs.map(function (doc) {
      var c = colorForDate(date, doc.time)
      return fcolor(c) + '[' + doc.shortKey + '] '
        + times[doc.key] + reset + ' ' + titles[doc.key]
    })
    console.log(layers([
      { text: caltxt, x: 0, y: 0 },
      { text: evlines.join('\n'), x: 22, y: 1 }
    ]))
  })
}

function getDocFromAbbreviation (key, cb) {
  var date = new Date
  cal.query(monthRange(date), function (err, docs) {
    if (err) return cb(err)

    var res = docs.filter(function (doc) {
      return doc.key.startsWith(key)
    })
    if (res.length > 0) {
      var doc = res[0]
      cb(null, doc)
    } else {
      cb(new Error('not found'))
    }
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

function abbreviate (lst) {
  var trie = buildTrie(lst)

  var res = {}

  lst.forEach(function (elm) {
    var t = trie
    for (var i=0; i < elm.length; i++) {
      var hasNext = Object.keys(t[elm[i]]).length > 0
      if (i === elm.length - 1 || !hasNext) {
        res[elm] = elm
        break
      } else if (t[elm[i]].idx === 0) {
        res[elm] = elm.substring(0, i + 1)
        break
      } else {
        t = t[elm[i]]
      }
    }
  })

  return res

  function buildTrie (lst) {
    var trie = {}
    for (var i=0; i < lst.length; i++) {
      var key = lst[i]
      var t = trie
      for (var j=0; j < key.length; j++) {
        var ch = key[j]
        if (t[ch] === undefined) {
          t[ch] = { idx: 0 }
          t = t[ch]
        } else {
          t = t[ch]
          t.idx++
        }
      }
    }
    return trie
  }
}

