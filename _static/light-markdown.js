
var lightMarkdown = {},
  tokens = getTokens(),
  regex = getRegex(tokens),
  plainToken = '₪₪PLaiN₪₪',
  options = {},
  flavors = {
    slack: {
      bold: true,
      italics: true,
      strikethrough: true,
      pre: true,
      code: true,
      longQuote: true,
      quote: true,
      autoLink: true,
      paragraph: true,
      lineBreaks: true
    },
    skype: {
      bold: true,
      italics: true,
      strikethrough: true,
      pre: false,
      code: false,
      longQuote: false,
      quote: false,
      autoLink: true,
      paragraph: false,
      lineBreaks: true
    }
  }

  /**
 * Set a global option
 * @static
 * @param {string} key
 * @param {*} value
 * @returns {lightMarkdown}
 */
lightMarkdown.setOption = function (key, value) {
  options[key] = !!value
  return this
}

/**
 * Get a global option
 * @static
 * @param {string} key
 * @returns {*}
 */
lightMarkdown.getOption = function (key) {
  return options[key]
}

lightMarkdown.setFlavor = function (flavorName) {
  var flavor = flavors[flavorName]
  if (flavor) {
    for (var option in flavor) {
      if (flavor.hasOwnProperty(option)) {
        options[option] = flavor[option]
      }
    }
  }
  return this
}

lightMarkdown.toHtml = function (md) {
  md = escapeHtml(md)
  var plains = []

  // Replace all tokens
  tokens.forEach(function (t) {
    if (options[t.name]) {
      md = md.replace(t.regex, function (match, g1, g2) {
        if (!g2 ||
                    t.requireNonTokens && !regex.nonTokensChars.test(g2) ||
                    (t.token.length === 1 && (g2[0] === t.token || g2.slice(-1) === t.token)) ||
                    t.spaceWrapIgnored && g2[0] === ' ' && g2.slice(-1) === ' ') { return match }

        if (typeof t.processContent === 'function') {
          g2 = t.processContent(g2)
        }
        if (t.plainContent) {
          var plainIndex = plains.push(g2) - 1
          g2 = plainToken + plainIndex
        }
        return g1 + '<' + t.elementName + '>' + g2 + '</' + t.elementName + '>'
      })
    }
  })

  if (options.longQuote) {
    md = md.replace(regex.multilineQuote, function (match, g1, g2) {
      if (match === '&gt;&gt;&gt;') { return match }

      // trim start unless there are more '>' ahead
      g2 = g2.replace(/^([\s]*)(&gt;)*/, function (m, gg1, gg2) {
        return gg2 ? m : ''
      })
      return '<blockquote>' + g2 + '</blockquote>'
    })
  }

  if (options.quote) {
    md = md.replace(regex.singleLineQuote, function (match, g1, g2) {
      if (match === '&gt;') { return match }
      g2 = g2.replace(/\n&gt;/g, '\n')
      return '<blockquote>' + g2 + '</blockquote>'
    })
  }

  if (options.autoLink) {
    // Replace links
    md = md.replace(regex.url, function (match, url) {
      var linkWrapperOpen = '',
        linkWrapperClose = ''

        // Link can be wrapped by round brackets, an allowed character in an url
      if (url.substring(0, 1) === '(') {
        var lastCharacter = url.slice(-1)
        linkWrapperOpen = '('
        url = url.slice(1, lastCharacter === ')' ? -1 : url.length)
        linkWrapperClose = lastCharacter === ')' ? ')' : ''
      }
      return linkWrapperOpen + '<a href="' + url + '" target="_blank">' + url + '</a>' + linkWrapperClose
    })
  }

  if (options.paragraph) {
    // Create paragraphs
    var m
    var doubleLineIndexes = []
    while ((m = regex.doubleLineBreak.exec(md))) {
      doubleLineIndexes.push({
        start: m.index,
        length: m[0].length
      })
    }
    while ((m = regex.blockquoteTags.exec(md))) {
      doubleLineIndexes.push({
        start: m.index,
        length: m[0].length,
        suffix: m[0]
      })
    }
    doubleLineIndexes.push({
      start: md.length,
      length: 0
    })

    doubleLineIndexes.sort(function (a, b) {
      return a.start - b.start
    })

    var withParagraphs = ''
    var startIndex = 0
    doubleLineIndexes.forEach(function (doubleLine) {
      var paragraph = ''
      var paragraphContent = md.substring(startIndex, doubleLine.start)
      if (paragraphContent) {
        paragraph = '<p>' + paragraphContent + '</p>'
      }
      if (doubleLine.suffix) {
        paragraph += doubleLine.suffix
      }
      withParagraphs += paragraph
      startIndex = doubleLine.start + doubleLine.length
    })
    md = withParagraphs
  }

  if (options.lineBreaks) {
    // Create line breaks
    md = md.replace(regex.singleLineBreak, '<br/>')
  }
  // Restore plain parts
  plains.forEach(function (p, plainIndex) {
    md = md.replace(plainToken + plainIndex, p)
  })

  return md
}

function escapeHtml (content) {
  if (content) {
    content = content.replace(/>/g, '&gt;')
    content = content.replace(/</g, '&lt;')
  }
  return content
}

function getRegex (tokens) {
  var allTokenChars = tokens.map(function (t) {
    return t.token.length === 1 ? t.token : ''
  }).join()

  var nonTokensCharsRegex = new RegExp('[^' + allTokenChars + ']')

  // Multiline quote >>>
  var multilineQuoteRegex = /(^|\n)&gt;&gt;&gt;([\s\S]*$)/

  // Single line quote > or sequential lines that start with >.
  var singleLineQuoteRegex = /(^|\n)&gt;(([^\n]*)(\n&gt;[^\n]*)*)/g

  // Two new lines in a row
  var doubleLineBreakRegex = /\r?\n\r?\n\r?/g

  // Single line break
  var singleLineBreakRegex = /\r?\n\r?/g

  // Url
  var urlRegex = /(\(?((https?:\/\/|ftp:\/\/).*?[a-z\u00a1-\uffff_\/0-9\-\#=._~:/?+,;=@()[\]&])(?=(\.|,|;|\?|\!)?("|'|«|»|\&gt\;|<|>|\[|\s|\r|\n|$)))/gi

  return {
    nonTokensChars: nonTokensCharsRegex,
    multilineQuote: multilineQuoteRegex,
    singleLineQuote: singleLineQuoteRegex,
    blockquoteTags: /<\/?blockquote>/ig,
    doubleLineBreak: doubleLineBreakRegex,
    singleLineBreak: singleLineBreakRegex,
    url: urlRegex
  }
}

// From http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escapeRegExp (str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
}

function getTokens () {
  var tokens = [
    {name: 'pre', token: '```', elementName: 'pre', multiline: true, plainContent: true},
    {name: 'code', token: '`', elementName: 'code', ignoreAfter: true, plainContent: true},
    {name: 'bold', token: '*', elementName: 'b', requireNonTokens: true, spaceWrapIgnored: true},
    {name: 'italics', token: '_', elementName: 'i', requireNonTokens: true},
    {name: 'strikethrough', token: '~', elementName: 's', requireNonTokens: true, spaceWrapIgnored: true}
  ]
  tokens.forEach(function (t) {
    if (!t.regex) {
      var before = '(^|[\\s\\?\\.,\\-!\\^;:{(\\[%$#+="])'
      var content = t.multiline ? '([\\s\\S]*?)?' : '(.*?\\S *)?'
      var after = t.ignoreAfter ? '' : '(?=$|\\s|[\\?\\.,\'\\-!\\^;:})\\]%$~{\\[<#+="])'
      var token = escapeRegExp(t.token)
      var pattern = before + token + content + token + after
      t.regex = new RegExp(pattern, 'g')
    }
  })
  return tokens
}

lightMarkdown.setFlavor('slack')

window.lightMarkdown = lightMarkdown
