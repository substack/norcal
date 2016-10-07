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
  var kv = this.kv
  kv.get(id, function (err, entry) {
    if (Object.keys(entry).length === 0) {
      return cb(new Error('No such event.'))
    }
    kv.del(id, cb)
  })
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
