var layers = require('text-layers')
var strftime = require('strftime')
var fcolor = require('fuzzy-ansi-color')
var reset = fcolor('reset')
var calmonth = require('calendar-month-string')
var has = require('has')
var xcolors = [
  'cyan', 'lime', 'orange', 'magenta',
  'yellow', 'red', 'blue', 'violet'
]

module.exports = function showMonth (date, today, docs) {
  var colors = {}
  var titles = {}
  var times = {}
  var index = 0
  var indexes = {}
  var keys = []

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
    if (strftime('%F',today) === strftime('%F',date)) {
      return 'reverse'
    } else {
      return 'bright ' + colour
    }
  }

  if (strftime('%Y-%m',today) === strftime('%Y-%m',date)) {
    colors[today.getDate()] = 'reverse'
  }
  docs.forEach(function (doc) {
    var d = Number(strftime('%e', doc.time))
    var i = indexes[doc.key]
    colors[d] = colorForDate(today, doc.time)
    titles[doc.key] = doc.value.title
    times[doc.key] = strftime('%a %b %e %H:%M', doc.time)
  })
  var caltxt = calmonth(date, { colors: colors })
  var evlines = docs.map(function (doc) {
    var c = colorForDate(today, doc.time)
    return fcolor(c) + '[' + doc.key + '] '
      + times[doc.key] + reset + ' ' + titles[doc.key]
  })
  return layers([
    { text: caltxt, x: 0, y: 0 },
    { text: evlines.join('\n'), x: 22, y: 1 }
  ])
}
