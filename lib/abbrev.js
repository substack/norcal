module.exports = function abbreviate (lst) {
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

