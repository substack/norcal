#!/usr/bin/env node

var minimist = require('minimist')
var path = require('path')
var homedir = require('os-homedir')
var norcal = require('../')
var showMonth = require('../lib/show-month.js')
var hyperlog = require('hyperlog')
var level = require('level')
var mkdirp = require('mkdirp')
var sprintf = require('sprintf')
var fs = require('fs')
var path = require('path')

var argv = minimist(process.argv.slice(2), {
  alias: {
    h: 'help',
    d: 'datadir',
    m: ['msg','message'],
    v: 'value',
    t: 'title'
  },
  boolean: [ '3' ],
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
  var opts = monthRange(new Date(argv.gt),new Date(argv.lt))
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
  var fdate = new Date, ldate = new Date
  var m
  if (argv['3']) { // like cal -3
    fdate.setMonth(fdate.getMonth()-1)
    ldate.setMonth(fdate.getMonth()+2)
  } else if (/^\d{4}$/.test(argv._.join(' '))) { // YYYY
    fdate = new Date(sprintf('%s-01-01 00:00:00',argv._.join(' ')))
    ldate = new Date(sprintf('%s-12-31 23:59:59',argv._.join(' ')))
  } else if (m = /^(\d{4})[\s-]+(\d{1,2})\b/.exec(argv._.join(' '))) {
    fdate = new Date(sprintf('%s-%02d-01 00:00:00',m[1],Number(m[2])))
    ldate = new Date(sprintf('%s-%02d-01 00:00:00',m[1],Number(m[2])))
  } else if (/^\w+$/.test(argv._.join(' '))) {
    fdate = new Date(argv._.join(' ') + ' ' + new Date().getFullYear())
    ldate = new Date(argv._.join(' ') + ' ' + new Date().getFullYear())
  } else if (/^\w+[\s-]+\w+/.test(argv._.join(' '))) {
    fdate = new Date(argv._.join(' '))
    ldate = new Date(argv._.join(' '))
  }

  var months = []
  var month = fdate.getMonth()
  var tmonth = (ldate.getFullYear()-fdate.getFullYear())*12 + ldate.getMonth()
  var year = fdate.getFullYear()
  for (; month <= tmonth; month++) {
    var yyyy = year + Math.floor(month/12)
    var mm = (month % 12) + 1
    months.push(sprintf('%d-%02d-01 00:00:00',yyyy,mm))
  }
  cal.query(monthRange(fdate,ldate), function (err, docs) {
    if (err) return exit(err)
    var mdocs = {}
    months.forEach(function (ym) { mdocs[ym] = [] })
    docs.forEach(function (doc) {
      var ym = sprintf('%d-%02d-01 00:00:00',
        doc.time.getFullYear(),doc.time.getMonth()+1)
      if (!mdocs[ym]) mdocs[ym] = []
      mdocs[ym].push(doc)
    })
    var today = new Date
    Object.keys(mdocs).sort().forEach(function (ym) {
      console.log(showMonth(new Date(ym), today, mdocs[ym]))
      console.log()
    })
  })
}

function getDocFromAbbreviation (key, cb) {
  var date = new Date
  cal.query(monthRange(date,date), function (err, docs) {
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

function monthRange (fdate, ldate) {
  var first = new Date(fdate)
  first.setHours(0)
  first.setMinutes(0)
  first.setSeconds(0)
  first.setDate(1)
  var last = new Date(ldate)
  last.setHours(0)
  last.setMinutes(0)
  last.setSeconds(0)
  last.setMonth(ldate.getMonth()+1)
  last.setDate(1)
  return { gt: first, lt: last }
}

function usage (code) {
  var r = fs.createReadStream(path.join(__dirname, 'usage.txt'))
  if (code) r.once('end', function () { process.exit(code) })
  r.pipe(process.stdout)
}
