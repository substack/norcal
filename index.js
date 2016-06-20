var hyperkv = require('hyperkv')
var hcali = require('hyperlog-calendar-index')
var sub = require('subleveldown')
var xtend = require('xtend')
var randombytes = require('randombytes')
var collect = require('collect-stream')
var through = require('through2')
var readonly = require('read-only-stream')

var KV = 'k', CAL = 'c'

module.exports = Cal

function Cal (opts) {
  var self = this
  if (!(self instanceof Cal)) return new Cal(opts)
  self.log = opts.log
  self.kv = hyperkv({
    log: self.log,
    db: sub(opts.db, KV)
  })
  self.cal = hcali({
    log: self.log,
    db: sub(opts.db, CAL),
    map: map
  })
  function map (row, next) {
    var v = row.value
    if (!v) return null
    else if (v.d !== undefined) {
      next(null, { type: 'del' })
    } else if (v.k !== undefined) {
      next(null, xtend(v.v, { type: 'put' }))
    }
  }
}

Cal.prototype.add = function (time, opts, cb) {
  var id = randombytes(8).toString('hex')
  this.kv.put(id, xtend(opts, { time: time }), function (err, node) {
    if (cb) cb(err, node, id)
  })
}

Cal.prototype.remove = function (id, cb) {
  var self = this
  if (id.length === 16) {
    this.kv.del(id, cb)
  } else {
    this.query(monthRange(new Date), function(err, docs) {
      if (cb) cb(err)
      var index = Number(id)
      if (isNaN(index)) {
        console.error('Could not find index: ' + id)
      } else {
        if (index <= docs.length - 1) {
          var key = docs[Number(id)].key
          self.kv.del(key, cb)
        } else {
          console.error('Could not find index: ' + id)
        }
      }
    });
  }
}

Cal.prototype.query = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts) opts = {}
  var self = this
  var stream = self.cal.query(opts).pipe(through.obj(write))

  if (cb) collect(stream, cb)
  return readonly(stream)

  function write (row, enc, next) {
    self.log.get(row.key, function (err, doc) {
      if (!doc.value || !doc.value.k) {
        next(new Error('missing key in ' + row.key))
      } else next(null, xtend(doc.value.v, {
        key: doc.value.k,
        time: row.time
      }))
    })
  }
}

function monthRange(date) {
    var first = new Date()
    first.setHours(0)
    first.setMinutes(0)
    first.setSeconds(0)
    first.setDate(1)
    var last = new Date(date)
    last.setHours(0)
    last.setMinutes(0)
    last.setSeconds(0)
    last.setMonth(date.getMonth() + 1)
    last.setDate(1)

    return { gt: first, lt: last }
}
