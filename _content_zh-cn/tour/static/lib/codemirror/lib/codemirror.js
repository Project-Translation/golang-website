// CodeMirror，由 Marijn Haverbeke 和其他人版权所有
// 以 MIT 许可证分发：http://codemirror.net/LICENSE

// 这是 CodeMirror（http://codemirror.net），一个基于浏览器 DOM 的 JavaScript 实现的代码编辑器。
//
// 您可以在 http://marijnhaverbeke.nl/blog/#cm-internals 找到一些代码的技术背景。

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.CodeMirror = factory());
}(this, (function () { 'use strict';

// 针对无法通过功能检测的错误和行为差异的补丁，根据 userAgent 等嗅探启用。
var userAgent = navigator.userAgent
var platform = navigator.platform

var gecko = /gecko\/\d/i.test(userAgent)
var ie_upto10 = /MSIE \d/.test(userAgent)
var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(userAgent)
var edge = /Edge\/(\d+)/.exec(userAgent)
var ie = ie_upto10 || ie_11up || edge
var ie_version = ie && (ie_upto10 ? document.documentMode || 6 : +(edge || ie_11up)[1])
var webkit = !edge && /WebKit\//.test(userAgent)
var qtwebkit = webkit && /Qt\/\d+\.\d+/.test(userAgent)
var chrome = !edge && /Chrome\//.test(userAgent)
var presto = /Opera\//.test(userAgent)
var safari = /Apple Computer/.test(navigator.vendor)
var mac_geMountainLion = /Mac OS X 1\d\D([8-9]|\d\d)\D/.test(userAgent)
var phantom = /PhantomJS/.test(userAgent)

var ios = !edge && /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent)
var android = /Android/.test(userAgent)
// 这非常不完整。欢迎提出替代方法的建议。
var mobile = ios || android || /webOS|BlackBerry|Opera Mini|Opera Mobi|IEMobile/i.test(userAgent)
var mac = ios || /Mac/.test(platform)
var chromeOS = /\bCrOS\b/.test(userAgent)
var windows = /win/i.test(platform)

var presto_version = presto && userAgent.match(/Version\/(\d*\.\d*)/)
if (presto_version) { presto_version = Number(presto_version[1]) }
if (presto_version && presto_version >= 15) { presto = false; webkit = true }
// 一些浏览器在 OS X 上使用错误的事件属性来表示 cmd/ctrl
var flipCtrlCmd = mac && (qtwebkit || presto && (presto_version == null || presto_version < 12.11))
var captureRightClick = gecko || (ie && ie_version >= 9)

function classTest(cls) { return new RegExp("(^|\\s)" + cls + "(?:$|\\s)\\s*") }

var rmClass = function(node, cls) {
  var current = node.className
  var match = classTest(cls).exec(current)
  if (match) {
    var after = current.slice(match.index + match[0].length)
    node.className = current.slice(0, match.index) + (after ? match[1] + after : "")
  }
}

function removeChildren(e) {
  for (var count = e.childNodes.length; count > 0; --count)
    { e.removeChild(e.firstChild) }
  return e
}

function removeChildrenAndAdd(parent, e) {
  return removeChildren(parent).appendChild(e)
}

function elt(tag, content, className, style) {
  var e = document.createElement(tag)
  if (className) { e.className = className }
  if (style) { e.style.cssText = style }
  if (typeof content == "string") { e.appendChild(document.createTextNode(content)) }
  else if (content) { for (var i = 0; i < content.length; ++i) { e.appendChild(content[i]) } }
  return e
}
// elt 的包装器，将 elt 从可访问性树中移除
function eltP(tag, content, className, style) {
  var e = elt(tag, content, className, style)
  e.setAttribute("role", "presentation")
  return e
}

var range
if (document.createRange) { range = function(node, start, end, endNode) {
  var r = document.createRange()
  r.setEnd(endNode || node, end)
  r.setStart(node, start)
  return r
} }
else { range = function(node, start, end) {
  var r = document.body.createTextRange()
  try { r.moveToElementText(node.parentNode) }
  catch(e) { return r }
  r.collapse(true)
  r.moveEnd("character", end)
  r.moveStart("character", start)
  return r
} }

function contains(parent, child) {
  if (child.nodeType == 3) // Android browser always returns false when child is a textnode
    { child = child.parentNode }
  if (parent.contains)
    { return parent.contains(child) }
  do {
    if (child.nodeType == 11) { child = child.host }
    if (child == parent) { return true }
  } while (child = child.parentNode)
}

function activeElt() {
  // IE and Edge may throw an "Unspecified Error" when accessing document.activeElement.
  // IE < 10 will throw when accessed while the page is loading or in an iframe.
  // IE > 9 and Edge will throw when accessed in an iframe if document.body is unavailable.
  var activeElement
  try {
    activeElement = document.activeElement
  } catch(e) {
    activeElement = document.body || null
  }
  while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement)
    { activeElement = activeElement.shadowRoot.activeElement }
  return activeElement
}

function addClass(node, cls) {
  var current = node.className
  if (!classTest(cls).test(current)) { node.className += (current ? " " : "") + cls }
}
function joinClasses(a, b) {
  var as = a.split(" ")
  for (var i = 0; i < as.length; i++)
    { if (as[i] && !classTest(as[i]).test(b)) { b += " " + as[i] } }
  return b
}

var selectInput = function(node) { node.select() }
if (ios) // Mobile Safari apparently has a bug where select() is broken.
  { selectInput = function(node) { node.selectionStart = 0; node.selectionEnd = node.value.length } }
else if (ie) // Suppress mysterious IE10 errors
  { selectInput = function(node) { try { node.select() } catch(_e) {} } }

function bind(f) {
  var args = Array.prototype.slice.call(arguments, 1)
  return function(){return f.apply(null, args)}
}

function copyObj(obj, target, overwrite) {
  if (!target) { target = {} }
  for (var prop in obj)
    { if (obj.hasOwnProperty(prop) && (overwrite !== false || !target.hasOwnProperty(prop)))
      { target[prop] = obj[prop] } }
  return target
}

// Counts the column offset in a string, taking tabs into account.
// Used mostly to find indentation.
function countColumn(string, end, tabSize, startIndex, startValue) {
  if (end == null) {
    end = string.search(/[^\s\u00a0]/)
    if (end == -1) { end = string.length }
  }
  for (var i = startIndex || 0, n = startValue || 0;;) {
    var nextTab = string.indexOf("\t", i)
    if (nextTab < 0 || nextTab >= end)
      { return n + (end - i) }
    n += nextTab - i
    n += tabSize - (n % tabSize)
    i = nextTab + 1
  }
}

var Delayed = function() {this.id = null};
Delayed.prototype.set = function (ms, f) {
  clearTimeout(this.id)
  this.id = setTimeout(f, ms)
};

function indexOf(array, elt) {
  for (var i = 0; i < array.length; ++i)
    { if (array[i] == elt) { return i } }
  return -1
}

// Number of pixels added to scroller and sizer to hide scrollbar
var scrollerGap = 30

// Returned or thrown by various protocols to signal 'I'm not
// handling this'.
var Pass = {toString: function(){return "CodeMirror.Pass"}}

// Reused option objects for setSelection & friends
var sel_dontScroll = {scroll: false};
var sel_mouse = {origin: "*mouse"};
var sel_move = {origin: "+move"};
// The inverse of countColumn -- find the offset that corresponds to
// a particular column.
function findColumn(string, goal, tabSize) {
  for (var pos = 0, col = 0;;) {
    var nextTab = string.indexOf("\t", pos)
    if (nextTab == -1) { nextTab = string.length }
    var skipped = nextTab - pos
    if (nextTab == string.length || col + skipped >= goal)
      { return pos + Math.min(skipped, goal - col) }
    col += nextTab - pos
    col += tabSize - (col % tabSize)
    pos = nextTab + 1
    if (col >= goal) { return pos }
  }
}

var spaceStrs = [""]
function spaceStr(n) {
  while (spaceStrs.length <= n)
    { spaceStrs.push(lst(spaceStrs) + " ") }
  return spaceStrs[n]
}

function lst(arr) { return arr[arr.length-1] }

function map(array, f) {
  var out = []
  for (var i = 0; i < array.length; i++) { out[i] = f(array[i], i) }
  return out
}

function insertSorted(array, value, score) {
  var pos = 0, priority = score(value)
  while (pos < array.length && score(array[pos]) <= priority) { pos++ }
  array.splice(pos, 0, value)
}

function nothing() {}

function createObj(base, props) {
  var inst
  if (Object.create) {
    inst = Object.create(base)
  } else {
    nothing.prototype = base
    inst = new nothing()
  }
  if (props) { copyObj(props, inst) }
  return inst
}

var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/
function isWordCharBasic(ch) {
  return /\w/.test(ch) || ch > "\x80" &&
    (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch))
}
function isWordChar(ch, helper) {
  if (!helper) { return isWordCharBasic(ch) }
  if (helper.source.indexOf("\\w") > -1 && isWordCharBasic(ch)) { return true }
  return helper.test(ch)
}

function isEmpty(obj) {
  for (var n in obj) { if (obj.hasOwnProperty(n) && obj[n]) { return false } }
  return true
}

// Extending unicode characters. A series of a non-extending char +
// any number of extending chars is treated as a single unit as far
// as editing and measuring is concerned. This is not fully correct,
// since some scripts/fonts/browsers also treat other configurations
// of code points as a group.
var extendingChars = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/
function isExtendingChar(ch) { return ch.charCodeAt(0) >= 768 && extendingChars.test(ch) }

// Returns a number from the range [`0`; `str.length`] unless `pos` is outside that range.
function skipExtendingChars(str, pos, dir) {
  while ((dir < 0 ? pos > 0 : pos < str.length) && isExtendingChar(str.charAt(pos))) { pos += dir }
  return pos
}

// Returns the value from the range [`from`; `to`] that satisfies
// `pred` and is closest to `from`. Assumes that at least `to` satisfies `pred`.
function findFirst(pred, from, to) {
  for (;;) {
    if (Math.abs(from - to) <= 1) { return pred(from) ? from : to }
    var mid = Math.floor((from + to) / 2)
    if (pred(mid)) { to = mid }
    else { from = mid }
  }
}

// The display handles the DOM integration, both for input reading
// and content drawing. It holds references to DOM nodes and
// display-related state.

function Display(place, doc, input) {
  var d = this
  this.input = input

  // Covers bottom-right square when both scrollbars are present.
  d.scrollbarFiller = elt("div", null, "CodeMirror-scrollbar-filler")
  d.scrollbarFiller.setAttribute("cm-not-content", "true")
  // Covers bottom of gutter when coverGutterNextToScrollbar is on
  // and h scrollbar is present.
  d.gutterFiller = elt("div", null, "CodeMirror-gutter-filler")
  d.gutterFiller.setAttribute("cm-not-content", "true")
  // Will contain the actual code, positioned to cover the viewport.
  d.lineDiv = eltP("div", null, "CodeMirror-code")
  // Elements are added to these to represent selection and cursors.
  d.selectionDiv = elt("div", null, null, "position: relative; z-index: 1")
  d.cursorDiv = elt("div", null, "CodeMirror-cursors")
  // A visibility: hidden element used to find the size of things.
  d.measure = elt("div", null, "CodeMirror-measure")
  // When lines outside of the viewport are measured, they are drawn in this.
  d.lineMeasure = elt("div", null, "CodeMirror-measure")
  // Wraps everything that needs to exist inside the vertically-padded coordinate system
  d.lineSpace = eltP("div", [d.measure, d.lineMeasure, d.selectionDiv, d.cursorDiv, d.lineDiv],
                    null, "position: relative; outline: none")
  var lines = eltP("div", [d.lineSpace], "CodeMirror-lines")
  // Moved around its parent to cover visible view.
  d.mover = elt("div", [lines], null, "position: relative")
  // Set to the height of the document, allowing scrolling.
  d.sizer = elt("div", [d.mover], "CodeMirror-sizer")
  d.sizerWidth = null
  // Behavior of elts with overflow: auto and padding is
  // inconsistent across browsers. This is used to ensure the
  // scrollable area is big enough.
  d.heightForcer = elt("div", null, null, "position: absolute; height: " + scrollerGap + "px; width: 1px;")
  // Will contain the gutters, if any.
  d.gutters = elt("div", null, "CodeMirror-gutters")
  d.lineGutter = null
  // Actual scrollable element.
  d.scroller = elt("div", [d.sizer, d.heightForcer, d.gutters], "CodeMirror-scroll")
  d.scroller.setAttribute("tabIndex", "-1")
  // The element in which the editor lives.
  d.wrapper = elt("div", [d.scrollbarFiller, d.gutterFiller, d.scroller], "CodeMirror")

  // Work around IE7 z-index bug (not perfect, hence IE7 not really being supported)
  if (ie && ie_version < 8) { d.gutters.style.zIndex = -1; d.scroller.style.paddingRight = 0 }
  if (!webkit && !(gecko && mobile)) { d.scroller.draggable = true }

  if (place) {
    if (place.appendChild) { place.appendChild(d.wrapper) }
    else { place(d.wrapper) }
  }

  // Current rendered range (may be bigger than the view window).
  d.viewFrom = d.viewTo = doc.first
  d.reportedViewFrom = d.reportedViewTo = doc.first
  // Information about the rendered lines.
  d.view = []
  d.renderedView = null
  // Holds info about a single rendered line when it was rendered
  // for measurement, while not in view.
  d.externalMeasured = null
  // Empty space (in pixels) above the view
  d.viewOffset = 0
  d.lastWrapHeight = d.lastWrapWidth = 0
  d.updateLineNumbers = null

  d.nativeBarWidth = d.barHeight = d.barWidth = 0
  d.scrollbarsClipped = false

  // Used to only resize the line number gutter when necessary (when
  // the amount of lines crosses a boundary that makes its width change)
  d.lineNumWidth = d.lineNumInnerWidth = d.lineNumChars = null
  // Set to true when a non-horizontal-scrolling line widget is
  // added. As an optimization, line widget aligning is skipped when
  // this is false.
  d.alignWidgets = false

  d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null

  // Tracks the maximum line length so that the horizontal scrollbar
  // can be kept static when scrolling.
  d.maxLine = null
  d.maxLineLength = 0
  d.maxLineChanged = false

  // Used for measuring wheel scrolling granularity
  d.wheelDX = d.wheelDY = d.wheelStartX = d.wheelStartY = null

  // True when shift is held down.
  d.shift = false

  // Used to track whether anything happened since the context menu
  // was opened.
  d.selForContextMenu = null

  d.activeTouch = null

  input.init(d)
}
// 查找与给定行号对应的行对象。
function getLine(doc, n) {
  n -= doc.first
  if (n < 0 || n >= doc.size) { throw new Error("文档中没有第 " + (n + doc.first) + " 行。") }
  var chunk = doc
  while (!chunk.lines) {
    for (var i = 0;; ++i) {
      var child = chunk.children[i], sz = child.chunkSize()
      if (n < sz) { chunk = child; break }
      n -= sz
    }
  }
  return chunk.lines[n]
}

// 获取文档中两个位置之间的部分，作为字符串数组。
function getBetween(doc, start, end) {
  var out = [], n = start.line
  doc.iter(start.line, end.line + 1, function (line) {
    var text = line.text
    if (n == end.line) { text = text.slice(0, end.ch) }
    if (n == start.line) { text = text.slice(start.ch) }
    out.push(text)
    ++n
  })
  return out
}
// 获取从和到之间的行，作为字符串数组。
function getLines(doc, from, to) {
  var out = []
  doc.iter(from, to, function (line) { out.push(line.text) }) // iter 在回调函数返回真值时中止
  return out
}

// 更新行的高度，并将高度变化向上传播到父节点。
function updateLineHeight(line, height) {
  var diff = height - line.height
  if (diff) { for (var n = line; n; n = n.parent) { n.height += diff } }
}

// 给定一个行对象，通过其父链接向上查找其行号。
function lineNo(line) {
  if (line.parent == null) { return null }
  var cur = line.parent, no = indexOf(cur.lines, line)
  for (var chunk = cur.parent; chunk; cur = chunk, chunk = chunk.parent) {
    for (var i = 0;; ++i) {
      if (chunk.children[i] == cur) { break }
      no += chunk.children[i].chunkSize()
    }
  }
  return no + cur.first
}

// 在给定的垂直位置查找行，使用文档树中的高度信息。
function lineAtHeight(chunk, h) {
  var n = chunk.first
  outer: do {
    for (var i$1 = 0; i$1 < chunk.children.length; ++i$1) {
      var child = chunk.children[i$1], ch = child.height
      if (h < ch) { chunk = child; continue outer }
      h -= ch
      n += child.chunkSize()
    }
    return n
  } while (!chunk.lines)
  var i = 0
  for (; i < chunk.lines.length; ++i) {
    var line = chunk.lines[i], lh = line.height
    if (h < lh) { break }
    h -= lh
  }
  return n + i
}

function isLine(doc, l) {return l >= doc.first && l < doc.first + doc.size}

function lineNumberFor(options, i) {
  return String(options.lineNumberFormatter(i + options.firstLineNumber))
}

// Pos 实例表示文本中的一个位置。
function Pos(line, ch, sticky) {
  if ( sticky === void 0 ) sticky = null;

  if (!(this instanceof Pos)) { return new Pos(line, ch, sticky) }
  this.line = line
  this.ch = ch
  this.sticky = sticky
}

// 比较两个位置，如果它们相同则返回 0，当 a 小于 b 时返回负数，否则返回正数。
function cmp(a, b) { return a.line - b.line || a.ch - b.ch }

function equalCursorPos(a, b) { return a.sticky == b.sticky && cmp(a, b) == 0 }

function copyPos(x) {return Pos(x.line, x.ch)}
function maxPos(a, b) { return cmp(a, b) < 0 ? b : a }
function minPos(a, b) { return cmp(a, b) < 0 ? a : b }
// 大多数外部API剪切位置以确保它们
// 确实存在于文档中。
function clipLine(doc, n) {return Math.max(doc.first, Math.min(n, doc.first + doc.size - 1))}
function clipPos(doc, pos) {
  if (pos.line < doc.first) { return Pos(doc.first, 0) }
  var last = doc.first + doc.size - 1
  if (pos.line > last) { return Pos(last, getLine(doc, last).text.length) }
  return clipToLen(pos, getLine(doc, pos.line).text.length)
}
function clipToLen(pos, linelen) {
  var ch = pos.ch
  if (ch == null || ch > linelen) { return Pos(pos.line, linelen) }
  else if (ch < 0) { return Pos(pos.line, 0) }
  else { return pos }
}
function clipPosArray(doc, array) {
  var out = []
  for (var i = 0; i < array.length; i++) { out[i] = clipPos(doc, array[i]) }
  return out
}

// 当这些功能未使用时优化一些代码。
var sawReadOnlySpans = false;
var sawCollapsedSpans = false;
function seeReadOnlySpans() {
  sawReadOnlySpans = true
}

function seeCollapsedSpans() {
  sawCollapsedSpans = true
}

// TEXTMARKER SPANS

function MarkedSpan(marker, from, to) {
  this.marker = marker
  this.from = from; this.to = to
}

// 在一个跨度数组中搜索与给定标记匹配的跨度。
function getMarkedSpanFor(spans, marker) {
  if (spans) { for (var i = 0; i < spans.length; ++i) {
    var span = spans[i]
    if (span.marker == marker) { return span }
  } }
}
// 从数组中移除一个跨度，如果没有跨度
// 剩下（我们不存储没有跨度的行的数组），则返回undefined。
function removeMarkedSpan(spans, span) {
  var r
  for (var i = 0; i < spans.length; ++i)
    { if (spans[i] != span) { (r || (r = [])).push(spans[i]) } }
  return r
}
// 向一行添加一个跨度。
function addMarkedSpan(line, span) {
  line.markedSpans = line.markedSpans ? line.markedSpans.concat([span]) : [span]
  span.marker.attachLine(line)
}

// 用于调整文档中更改的标记的算法。这些函数在给定的
// 字符位置剪切一个跨度数组，返回剩余块的数组（或
// 如果什么都没有剩下，则返回undefined）。
function markedSpansBefore(old, startCh, isInsert) {
  var nw
  if (old) { for (var i = 0; i < old.length; ++i) {
    var span = old[i], marker = span.marker
    var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= startCh : span.from < startCh)
    if (startsBefore || span.from == startCh && marker.type == "bookmark" && (!isInsert || !span.marker.insertLeft)) {
      var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= startCh : span.to > startCh)
      ;(nw || (nw = [])).push(new MarkedSpan(marker, span.from, endsAfter ? null : span.to))
    }
  } }
  return nw
}
function markedSpansAfter(old, endCh, isInsert) {
  var nw
  if (old) { for (var i = 0; i < old.length; ++i) {
    var span = old[i], marker = span.marker
    var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= endCh : span.to > endCh)
    if (endsAfter || span.from == endCh && marker.type == "bookmark" && (!isInsert || span.marker.insertLeft)) {
      var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= endCh : span.from < endCh)
      ;(nw || (nw = [])).push(new MarkedSpan(marker, startsBefore ? null : span.from - endCh,
                                            span.to == null ? null : span.to - endCh))
    }
  } }
  return nw
}

// Given a change object, compute the new set of marker spans that
// cover the line in which the change took place. Removes spans
// entirely within the change, reconnects spans belonging to the
// same marker that appear on both sides of the change, and cuts off
// spans partially within the change. Returns an array of span
// arrays with one element for each line in (after) the change.
function stretchSpansOverChange(doc, change) {
  if (change.full) { return null }
  var oldFirst = isLine(doc, change.from.line) && getLine(doc, change.from.line).markedSpans
  var oldLast = isLine(doc, change.to.line) && getLine(doc, change.to.line).markedSpans
  if (!oldFirst && !oldLast) { return null }

  var startCh = change.from.ch, endCh = change.to.ch, isInsert = cmp(change.from, change.to) == 0
  // Get the spans that 'stick out' on both sides
  var first = markedSpansBefore(oldFirst, startCh, isInsert)
  var last = markedSpansAfter(oldLast, endCh, isInsert)

  // Next, merge those two ends
  var sameLine = change.text.length == 1, offset = lst(change.text).length + (sameLine ? startCh : 0)
  if (first) {
    // Fix up .to properties of first
    for (var i = 0; i < first.length; ++i) {
      var span = first[i]
      if (span.to == null) {
        var found = getMarkedSpanFor(last, span.marker)
        if (!found) { span.to = startCh }
        else if (sameLine) { span.to = found.to == null ? null : found.to + offset }
      }
    }
  }
  if (last) {
    // Fix up .from in last (or move them into first in case of sameLine)
    for (var i$1 = 0; i$1 < last.length; ++i$1) {
      var span$1 = last[i$1]
      if (span$1.to != null) { span$1.to += offset }
      if (span$1.from == null) {
        var found$1 = getMarkedSpanFor(first, span$1.marker)
        if (!found$1) {
          span$1.from = offset
          if (sameLine) { (first || (first = [])).push(span$1) }
        }
      } else {
        span$1.from += offset
        if (sameLine) { (first || (first = [])).push(span$1) }
      }
    }
  }
  // Make sure we didn't create any zero-length spans
  if (first) { first = clearEmptySpans(first) }
  if (last && last != first) { last = clearEmptySpans(last) }

  var newMarkers = [first]
  if (!sameLine) {
    // Fill gap with whole-line-spans
    var gap = change.text.length - 2, gapMarkers
    if (gap > 0 && first)
      { for (var i$2 = 0; i$2 < first.length; ++i$2)
        { if (first[i$2].to == null)
          { (gapMarkers || (gapMarkers = [])).push(new MarkedSpan(first[i$2].marker, null, null)) } } }
    for (var i$3 = 0; i$3 < gap; ++i$3)
      { newMarkers.push(gapMarkers) }
    newMarkers.push(last)
  }
  return newMarkers
}

// Remove spans that are empty and don't have a clearWhenEmpty
// option of false.
function clearEmptySpans(spans) {
  for (var i = 0; i < spans.length; ++i) {
    var span = spans[i]
    if (span.from != null && span.from == span.to && span.marker.clearWhenEmpty !== false)
      { spans.splice(i--, 1) }
  }
  if (!spans.length) { return null }
  return spans
}

// Used to 'clip' out readOnly ranges when making a change.
function removeReadOnlyRanges(doc, from, to) {
  var markers = null
  doc.iter(from.line, to.line + 1, function (line) {
    if (line.markedSpans) { for (var i = 0; i < line.markedSpans.length; ++i) {
      var mark = line.markedSpans[i].marker
      if (mark.readOnly && (!markers || indexOf(markers, mark) == -1))
        { (markers || (markers = [])).push(mark) }
    } }
  })
  if (!markers) { return null }
  var parts = [{from: from, to: to}]
  for (var i = 0; i < markers.length; ++i) {
    var mk = markers[i], m = mk.find(0)
    for (var j = 0; j < parts.length; ++j) {
      var p = parts[j]
      if (cmp(p.to, m.from) < 0 || cmp(p.from, m.to) > 0) { continue }
      var newParts = [j, 1], dfrom = cmp(p.from, m.from), dto = cmp(p.to, m.to)
      if (dfrom < 0 || !mk.inclusiveLeft && !dfrom)
        { newParts.push({from: p.from, to: m.from}) }
      if (dto > 0 || !mk.inclusiveRight && !dto)
        { newParts.push({from: m.to, to: p.to}) }
      parts.splice.apply(parts, newParts)
      j += newParts.length - 3
    }
  }
  return parts
}

// Connect or disconnect spans from a line.
function detachMarkedSpans(line) {
  var spans = line.markedSpans
  if (!spans) { return }
  for (var i = 0; i < spans.length; ++i)
    { spans[i].marker.detachLine(line) }
  line.markedSpans = null
}
function attachMarkedSpans(line, spans) {
  if (!spans) { return }
  for (var i = 0; i < spans.length; ++i)
    { spans[i].marker.attachLine(line) }
  line.markedSpans = spans
}

// Helpers used when computing which overlapping collapsed span
// counts as the larger one.
function extraLeft(marker) { return marker.inclusiveLeft ? -1 : 0 }
function extraRight(marker) { return marker.inclusiveRight ? 1 : 0 }

// Returns a number indicating which of two overlapping collapsed
// spans is larger (and thus includes the other). Falls back to
// comparing ids when the spans cover exactly the same range.
function compareCollapsedMarkers(a, b) {
  var lenDiff = a.lines.length - b.lines.length
  if (lenDiff != 0) { return lenDiff }
  var aPos = a.find(), bPos = b.find()
  var fromCmp = cmp(aPos.from, bPos.from) || extraLeft(a) - extraLeft(b)
  if (fromCmp) { return -fromCmp }
  var toCmp = cmp(aPos.to, bPos.to) || extraRight(a) - extraRight(b)
  if (toCmp) { return toCmp }
  return b.id - a.id
}

// Find out whether a line ends or starts in a collapsed span. If
// so, return the marker for that span.
function collapsedSpanAtSide(line, start) {
  var sps = sawCollapsedSpans && line.markedSpans, found
  if (sps) { for (var sp = (void 0), i = 0; i < sps.length; ++i) {
    sp = sps[i]
    if (sp.marker.collapsed && (start ? sp.from : sp.to) == null &&
        (!found || compareCollapsedMarkers(found, sp.marker) < 0))
      { found = sp.marker }
  } }
  return found
}
function collapsedSpanAtStart(line) { return collapsedSpanAtSide(line, true) }
function collapsedSpanAtEnd(line) { return collapsedSpanAtSide(line, false) }
// 测试是否存在部分重叠（覆盖新范围的开始或结束，但不是两者兼有）的折叠范围。
// 这种重叠是不允许的。
function conflictingCollapsedRange(doc, lineNo, from, to, marker) {
  var line = getLine(doc, lineNo)
  var sps = sawCollapsedSpans && line.markedSpans
  if (sps) { for (var i = 0; i < sps.length; ++i) {
    var sp = sps[i]
    if (!sp.marker.collapsed) { continue }
    var found = sp.marker.find(0)
    var fromCmp = cmp(found.from, from) || extraLeft(sp.marker) - extraLeft(marker)
    var toCmp = cmp(found.to, to) || extraRight(sp.marker) - extraRight(marker)
    if (fromCmp >= 0 && toCmp <= 0 || fromCmp <= 0 && toCmp >= 0) { continue }
    if (fromCmp <= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.to, from) >= 0 : cmp(found.to, from) > 0) ||
        fromCmp >= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.from, to) <= 0 : cmp(found.from, to) < 0))
      { return true }
  } }
}

// 视觉行是屏幕上绘制的行。例如，折叠可以导致多个逻辑行出现在同一视觉行上。
// 这将找到给定行所属的视觉行的开始（通常是该行本身）。
function visualLine(line) {
  var merged
  while (merged = collapsedSpanAtStart(line))
    { line = merged.find(-1, true).line }
  return line
}

function visualLineEnd(line) {
  var merged
  while (merged = collapsedSpanAtEnd(line))
    { line = merged.find(1, true).line }
  return line
}

// 返回继续由参数开始的视觉行的逻辑行数组，如果没有这样的行，则返回未定义。
function visualLineContinued(line) {
  var merged, lines
  while (merged = collapsedSpanAtEnd(line)) {
    line = merged.find(1, true).line
    ;(lines || (lines = [])).push(line)
  }
  return lines
}

// 获取给定行号所属的视觉行的开始行号。
function visualLineNo(doc, lineN) {
  var line = getLine(doc, lineN), vis = visualLine(line)
  if (line == vis) { return lineN }
  return lineNo(vis)
}

// 获取给定行号之后的下一个视觉行的开始行号。
function visualLineEndNo(doc, lineN) {
  if (lineN > doc.lastLine()) { return lineN }
  var line = getLine(doc, lineN), merged
  if (!lineIsHidden(doc, line)) { return lineN }
  while (merged = collapsedSpanAtEnd(line))
    { line = merged.find(1, true).line }
  return lineNo(line) + 1
}

// 计算一行是否隐藏。当一行是开始于另一行的视觉行的一部分时，或当它完全被折叠的非小部件范围覆盖时，视为隐藏。
function lineIsHidden(doc, line) {
  var sps = sawCollapsedSpans && line.markedSpans
  if (sps) { for (var sp = (void 0), i = 0; i < sps.length; ++i) {
    sp = sps[i]
    if (!sp.marker.collapsed) { continue }
    if (sp.from == null) { return true }
    if (sp.marker.widgetNode) { continue }
    if (sp.from == 0 && sp.marker.inclusiveLeft && lineIsHiddenInner(doc, line, sp))
      { return true }
  } }
}
function lineIsHiddenInner(doc, line, span) {
  if (span.to == null) {
    var end = span.marker.find(1, true)
    return lineIsHiddenInner(doc, end.line, getMarkedSpanFor(end.line.markedSpans, span.marker))
  }
  if (span.marker.inclusiveRight && span.to == line.text.length)
    { return true }
  for (var sp = (void 0), i = 0; i < line.markedSpans.length; ++i) {
    sp = line.markedSpans[i]
    if (sp.marker.collapsed && !sp.marker.widgetNode && sp.from == span.to &&
        (sp.to == null || sp.to != span.from) &&
        (sp.marker.inclusiveLeft || span.marker.inclusiveRight) &&
        lineIsHiddenInner(doc, line, sp)) { return true }
  }
}

// 查找给定行上方的高度。
function heightAtLine(lineObj) {
  lineObj = visualLine(lineObj)

  var h = 0, chunk = lineObj.parent
  for (var i = 0; i < chunk.lines.length; ++i) {
    var line = chunk.lines[i]
    if (line == lineObj) { break }
    else { h += line.height }
  }
  for (var p = chunk.parent; p; chunk = p, p = chunk.parent) {
    for (var i$1 = 0; i$1 < p.children.length; ++i$1) {
      var cur = p.children[i$1]
      if (cur == chunk) { break }
      else { h += cur.height }
    }
  }
  return h
}

// Compute the character length of a line, taking into account
// collapsed ranges (see markText) that might hide parts, and join
// other lines onto it.
function lineLength(line) {
  if (line.height == 0) { return 0 }
  var len = line.text.length, merged, cur = line
  while (merged = collapsedSpanAtStart(cur)) {
    var found = merged.find(0, true)
    cur = found.from.line
    len += found.from.ch - found.to.ch
  }
  cur = line
  while (merged = collapsedSpanAtEnd(cur)) {
    var found$1 = merged.find(0, true)
    len -= cur.text.length - found$1.from.ch
    cur = found$1.to.line
    len += cur.text.length - found$1.to.ch
  }
  return len
}

// Find the longest line in the document.
function findMaxLine(cm) {
  var d = cm.display, doc = cm.doc
  d.maxLine = getLine(doc, doc.first)
  d.maxLineLength = lineLength(d.maxLine)
  d.maxLineChanged = true
  doc.iter(function (line) {
    var len = lineLength(line)
    if (len > d.maxLineLength) {
      d.maxLineLength = len
      d.maxLine = line
    }
  })
}

// BIDI HELPERS

function iterateBidiSections(order, from, to, f) {
  if (!order) { return f(from, to, "ltr") }
  var found = false
  for (var i = 0; i < order.length; ++i) {
    var part = order[i]
    if (part.from < to && part.to > from || from == to && part.to == from) {
      f(Math.max(part.from, from), Math.min(part.to, to), part.level == 1 ? "rtl" : "ltr")
      found = true
    }
  }
  if (!found) { f(from, to, "ltr") }
}

var bidiOther = null
function getBidiPartAt(order, ch, sticky) {
  var found
  bidiOther = null
  for (var i = 0; i < order.length; ++i) {
    var cur = order[i]
    if (cur.from < ch && cur.to > ch) { return i }
    if (cur.to == ch) {
      if (cur.from != cur.to && sticky == "before") { found = i }
      else { bidiOther = i }
    }
    if (cur.from == ch) {
      if (cur.from != cur.to && sticky != "before") { found = i }
      else { bidiOther = i }
    }
  }
  return found != null ? found : bidiOther
}

// Bidirectional ordering algorithm
// See http://unicode.org/reports/tr9/tr9-13.html for the algorithm
// that this (partially) implements.

// One-char codes used for character types:
// L (L):   Left-to-Right
// R (R):   Right-to-Left
// r (AL):  Right-to-Left Arabic
// 1 (EN):  European Number
// + (ES):  European Number Separator
// % (ET):  European Number Terminator
// n (AN):  Arabic Number
// , (CS):  Common Number Separator
// m (NSM): Non-Spacing Mark
// b (BN):  Boundary Neutral
// s (B):   Paragraph Separator
// t (S):   Segment Separator
// w (WS):  Whitespace
// N (ON):  Other Neutrals

// Returns null if characters are ordered as they appear
// (left-to-right), or an array of sections ({from, to, level}
// objects) in the order in which they occur visually.
var bidiOrdering = (function() {
  // Character types for codepoints 0 to 0xff
  var lowTypes = "bbbbbbbbbtstwsbbbbbbbbbbbbbbssstwNN%%%NNNNNN,N,N1111111111NNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNbbbbbbsbbbbbbbbbbbbbbbbbbbbbbbbbb,N%%%%NNNNLNNNNN%%11NLNNN1LNNNNNLLLLLLLLLLLLLLLLLLLLLLLNLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLN"
  // Character types for codepoints 0x600 to 0x6f9
  var arabicTypes = "nnnnnnNNr%%r,rNNmmmmmmmmmmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmmmmmmnnnnnnnnnn%nnrrrmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmnNmmmmmmrrmmNmmmmrr1111111111"
  function charType(code) {
    if (code <= 0xf7) { return lowTypes.charAt(code) }
    else if (0x590 <= code && code <= 0x5f4) { return "R" }
    else if (0x600 <= code && code <= 0x6f9) { return arabicTypes.charAt(code - 0x600) }
    else if (0x6ee <= code && code <= 0x8ac) { return "r" }
    else if (0x2000 <= code && code <= 0x200b) { return "w" }
    else if (code == 0x200c) { return "b" }
    else { return "L" }
  }

  var bidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/
  var isNeutral = /[stwN]/, isStrong = /[LRr]/, countsAsLeft = /[Lb1n]/, countsAsNum = /[1n]/

  function BidiSpan(level, from, to) {
    this.level = level
    this.from = from; this.to = to
  }

  return function(str, direction) {
    var outerType = direction == "ltr" ? "L" : "R"

    if (str.length == 0 || direction == "ltr" && !bidiRE.test(str)) { return false }
    var len = str.length, types = []
    for (var i = 0; i < len; ++i)
      { types.push(charType(str.charCodeAt(i))) }

    // W1. Examine each non-spacing mark (NSM) in the level run, and
    // change the type of the NSM to the type of the previous
    // character. If the NSM is at the start of the level run, it will
    // get the type of sor.
    for (var i$1 = 0, prev = outerType; i$1 < len; ++i$1) {
      var type = types[i$1]
      if (type == "m") { types[i$1] = prev }
      else { prev = type }
    }

    // W2. Search backwards from each instance of a European number
    // until the first strong type (R, L, AL, or sor) is found. If an
    // AL is found, change the type of the European number to Arabic
    // number.
    // W3. Change all ALs to R.
    for (var i$2 = 0, cur = outerType; i$2 < len; ++i$2) {
      var type$1 = types[i$2]
      if (type$1 == "1" && cur == "r") { types[i$2] = "n" }
      else if (isStrong.test(type$1)) { cur = type$1; if (type$1 == "r") { types[i$2] = "R" } }
    }

    // W4. A single European separator between two European numbers
    // changes to a European number. A single common separator between
    // two numbers of the same type changes to that type.
    for (var i$3 = 1, prev$1 = types[0]; i$3 < len - 1; ++i$3) {
      var type$2 = types[i$3]
      if (type$2 == "+" && prev$1 == "1" && types[i$3+1] == "1") { types[i$3] = "1" }
      else if (type$2 == "," && prev$1 == types[i$3+1] &&
               (prev$1 == "1" || prev$1 == "n")) { types[i$3] = prev$1 }
      prev$1 = type$2
    }

    // W5. A sequence of European terminators adjacent to European
    // numbers changes to all European numbers.
    // W6. Otherwise, separators and terminators change to Other
    // Neutral.
    for (var i$4 = 0; i$4 < len; ++i$4) {
      var type$3 = types[i$4]
      if (type$3 == ",") { types[i$4] = "N" }
      else if (type$3 == "%") {
        var end = (void 0)
        for (end = i$4 + 1; end < len && types[end] == "%"; ++end) {}
        var replace = (i$4 && types[i$4-1] == "!") || (end < len && types[end] == "1") ? "1" : "N"
        for (var j = i$4; j < end; ++j) { types[j] = replace }
        i$4 = end - 1
      }
    }

    // W7. Search backwards from each instance of a European number
    // until the first strong type (R, L, or sor) is found. If an L is
    // found, then change the type of the European number to L.
    for (var i$5 = 0, cur$1 = outerType; i$5 < len; ++i$5) {
      var type$4 = types[i$5]
      if (cur$1 == "L" && type$4 == "1") { types[i$5] = "L" }
      else if (isStrong.test(type$4)) { cur$1 = type$4 }
    }

    // N1. A sequence of neutrals takes the direction of the
    // surrounding strong text if the text on both sides has the same
    // direction. European and Arabic numbers act as if they were R in
    // terms of their influence on neutrals. Start-of-level-run (sor)
    // and end-of-level-run (eor) are used at level run boundaries.
    // N2. Any remaining neutrals take the embedding direction.
    for (var i$6 = 0; i$6 < len; ++i$6) {
      if (isNeutral.test(types[i$6])) {
        var end$1 = (void 0)
        for (end$1 = i$6 + 1; end$1 < len && isNeutral.test(types[end$1]); ++end$1) {}
        var before = (i$6 ? types[i$6-1] : outerType) == "L"
        var after = (end$1 < len ? types[end$1] : outerType) == "L"
        var replace$1 = before == after ? (before ? "L" : "R") : outerType
        for (var j$1 = i$6; j$1 < end$1; ++j$1) { types[j$1] = replace$1 }
        i$6 = end$1 - 1
      }
    }

    // Here we depart from the documented algorithm, in order to avoid
    // building up an actual levels array. Since there are only three
    // levels (0, 1, 2) in an implementation that doesn't take
    // explicit embedding into account, we can build up the order on
    // the fly, without following the level-based algorithm.
    var order = [], m
    for (var i$7 = 0; i$7 < len;) {
      if (countsAsLeft.test(types[i$7])) {
        var start = i$7
        for (++i$7; i$7 < len && countsAsLeft.test(types[i$7]); ++i$7) {}
        order.push(new BidiSpan(0, start, i$7))
      } else {
        var pos = i$7, at = order.length
        for (++i$7; i$7 < len && types[i$7] != "L"; ++i$7) {}
        for (var j$2 = pos; j$2 < i$7;) {
          if (countsAsNum.test(types[j$2])) {
            if (pos < j$2) { order.splice(at, 0, new BidiSpan(1, pos, j$2)) }
            var nstart = j$2
            for (++j$2; j$2 < i$7 && countsAsNum.test(types[j$2]); ++j$2) {}
            order.splice(at, 0, new BidiSpan(2, nstart, j$2))
            pos = j$2
          } else { ++j$2 }
        }
        if (pos < i$7) { order.splice(at, 0, new BidiSpan(1, pos, i$7)) }
      }
    }
    if (order[0].level == 1 && (m = str.match(/^\s+/))) {
      order[0].from = m[0].length
      order.unshift(new BidiSpan(0, 0, m[0].length))
    }
    if (lst(order).level == 1 && (m = str.match(/\s+$/))) {
      lst(order).to -= m[0].length
      order.push(new BidiSpan(0, len - m[0].length, len))
    }

    return direction == "rtl" ? order.reverse() : order
  }
})()

// Get the bidi ordering for the given line (and cache it). Returns
// false for lines that are fully left-to-right, and an array of
// BidiSpan objects otherwise.
function getOrder(line, direction) {
  var order = line.order
  if (order == null) { order = line.order = bidiOrdering(line.text, direction) }
  return order
}

function moveCharLogically(line, ch, dir) {
  var target = skipExtendingChars(line.text, ch + dir, dir)
  return target < 0 || target > line.text.length ? null : target
}

function moveLogically(line, start, dir) {
  var ch = moveCharLogically(line, start.ch, dir)
  return ch == null ? null : new Pos(start.line, ch, dir < 0 ? "after" : "before")
}

function endOfLine(visually, cm, lineObj, lineNo, dir) {
  if (visually) {
    var order = getOrder(lineObj, cm.doc.direction)
    if (order) {
      var part = dir < 0 ? lst(order) : order[0]
      var moveInStorageOrder = (dir < 0) == (part.level == 1)
      var sticky = moveInStorageOrder ? "after" : "before"
      var ch
      // With a wrapped rtl chunk (possibly spanning multiple bidi parts),
      // it could be that the last bidi part is not on the last visual line,
      // since visual lines contain content order-consecutive chunks.
      // Thus, in rtl, we are looking for the first (content-order) character
      // in the rtl chunk that is on the last line (that is, the same line
      // as the last (content-order) character).
      if (part.level > 0) {
        var prep = prepareMeasureForLine(cm, lineObj)
        ch = dir < 0 ? lineObj.text.length - 1 : 0
        var targetTop = measureCharPrepared(cm, prep, ch).top
        ch = findFirst(function (ch) { return measureCharPrepared(cm, prep, ch).top == targetTop; }, (dir < 0) == (part.level == 1) ? part.from : part.to - 1, ch)
        if (sticky == "before") { ch = moveCharLogically(lineObj, ch, 1, true) }
      } else { ch = dir < 0 ? part.to : part.from }
      return new Pos(lineNo, ch, sticky)
    }
  }
  return new Pos(lineNo, dir < 0 ? lineObj.text.length : 0, dir < 0 ? "before" : "after")
}

function moveVisually(cm, line, start, dir) {
  var bidi = getOrder(line, cm.doc.direction)
  if (!bidi) { return moveLogically(line, start, dir) }
  if (start.ch >= line.text.length) {
    start.ch = line.text.length
    start.sticky = "before"
  } else if (start.ch <= 0) {
    start.ch = 0
    start.sticky = "after"
  }
  var partPos = getBidiPartAt(bidi, start.ch, start.sticky), part = bidi[partPos]
  if (cm.doc.direction == "ltr" && part.level % 2 == 0 && (dir > 0 ? part.to > start.ch : part.from < start.ch)) {
    // Case 1: We move within an ltr part in an ltr editor. Even with wrapped lines,
    // nothing interesting happens.
    return moveLogically(line, start, dir)
  }

  var mv = function (pos, dir) { return moveCharLogically(line, pos instanceof Pos ? pos.ch : pos, dir); }
  var prep
  var getWrappedLineExtent = function (ch) {
    if (!cm.options.lineWrapping) { return {begin: 0, end: line.text.length} }
    prep = prep || prepareMeasureForLine(cm, line)
    return wrappedLineExtentChar(cm, line, prep, ch)
  }
  var wrappedLineExtent = getWrappedLineExtent(start.sticky == "before" ? mv(start, -1) : start.ch)

  if (cm.doc.direction == "rtl" || part.level == 1) {
    var moveInStorageOrder = (part.level == 1) == (dir < 0)
    var ch = mv(start, moveInStorageOrder ? 1 : -1)
    if (ch != null && (!moveInStorageOrder ? ch >= part.from && ch >= wrappedLineExtent.begin : ch <= part.to && ch <= wrappedLineExtent.end)) {
      // Case 2: We move within an rtl part or in an rtl editor on the same visual line
      var sticky = moveInStorageOrder ? "before" : "after"
      return new Pos(start.line, ch, sticky)
    }
  }

  // Case 3: Could not move within this bidi part in this visual line, so leave
  // the current bidi part

  var searchInVisualLine = function (partPos, dir, wrappedLineExtent) {
    var getRes = function (ch, moveInStorageOrder) { return moveInStorageOrder
      ? new Pos(start.line, mv(ch, 1), "before")
      : new Pos(start.line, ch, "after"); }

    for (; partPos >= 0 && partPos < bidi.length; partPos += dir) {
      var part = bidi[partPos]
      var moveInStorageOrder = (dir > 0) == (part.level != 1)
      var ch = moveInStorageOrder ? wrappedLineExtent.begin : mv(wrappedLineExtent.end, -1)
      if (part.from <= ch && ch < part.to) { return getRes(ch, moveInStorageOrder) }
      ch = moveInStorageOrder ? part.from : mv(part.to, -1)
      if (wrappedLineExtent.begin <= ch && ch < wrappedLineExtent.end) { return getRes(ch, moveInStorageOrder) }
    }
  }
// 情况3a：在同一视觉行上查找其他双向部分
var res = searchInVisualLine(partPos + dir, dir, wrappedLineExtent)
if (res) { return res }

// 情况3b：在下一视觉行上查找其他双向部分
var nextCh = dir > 0 ? wrappedLineExtent.end : mv(wrappedLineExtent.begin, -1)
if (nextCh != null && !(dir > 0 && nextCh == line.text.length)) {
  res = searchInVisualLine(dir > 0 ? 0 : bidi.length - 1, dir, getWrappedLineExtent(nextCh))
  if (res) { return res }
}

// 情况4：无处移动
return null
}

// 事件处理

// 轻量级事件框架。on/off也可以在DOM节点上工作，
// 注册原生DOM处理程序。

var noHandlers = []

var on = function(emitter, type, f) {
  if (emitter.addEventListener) {
    emitter.addEventListener(type, f, false)
  } else if (emitter.attachEvent) {
    emitter.attachEvent("on" + type, f)
  } else {
    var map = emitter._handlers || (emitter._handlers = {})
    map[type] = (map[type] || noHandlers).concat(f)
  }
}

function getHandlers(emitter, type) {
  return emitter._handlers && emitter._handlers[type] || noHandlers
}

function off(emitter, type, f) {
  if (emitter.removeEventListener) {
    emitter.removeEventListener(type, f, false)
  } else if (emitter.detachEvent) {
    emitter.detachEvent("on" + type, f)
  } else {
    var map = emitter._handlers, arr = map && map[type]
    if (arr) {
      var index = indexOf(arr, f)
      if (index > -1)
        { map[type] = arr.slice(0, index).concat(arr.slice(index + 1)) }
    }
  }
}

function signal(emitter, type /*, values...*/) {
  var handlers = getHandlers(emitter, type)
  if (!handlers.length) { return }
  var args = Array.prototype.slice.call(arguments, 2)
  for (var i = 0; i < handlers.length; ++i) { handlers[i].apply(null, args) }
}

// CodeMirror处理的DOM事件可以通过在编辑器上为事件名称注册一个（非DOM）处理程序来覆盖，
// 并在该处理程序中阻止默认事件。
function signalDOMEvent(cm, e, override) {
  if (typeof e == "string")
    { e = {type: e, preventDefault: function() { this.defaultPrevented = true }} }
  signal(cm, override || e.type, cm, e)
  return e_defaultPrevented(e) || e.codemirrorIgnore
}

function signalCursorActivity(cm) {
  var arr = cm._handlers && cm._handlers.cursorActivity
  if (!arr) { return }
  var set = cm.curOp.cursorActivityHandlers || (cm.curOp.cursorActivityHandlers = [])
  for (var i = 0; i < arr.length; ++i) { if (indexOf(set, arr[i]) == -1)
    { set.push(arr[i]) } }
}

function hasHandler(emitter, type) {
  return getHandlers(emitter, type).length > 0
}

// 将on和off方法添加到构造函数的原型中，以便在这些对象上注册事件更加方便。
function eventMixin(ctor) {
  ctor.prototype.on = function(type, f) {on(this, type, f)}
  ctor.prototype.off = function(type, f) {off(this, type, f)}
}

// 由于我们仍然支持古老的IE版本，需要一些兼容性包装器。

function e_preventDefault(e) {
  if (e.preventDefault) { e.preventDefault() }
  else { e.returnValue = false }
}
function e_stopPropagation(e) {
  if (e.stopPropagation) { e.stopPropagation() }
  else { e.cancelBubble = true }
}
function e_defaultPrevented(e) {
  return e.defaultPrevented != null ? e.defaultPrevented : e.returnValue == false
}
function e_stop(e) {e_preventDefault(e); e_stopPropagation(e)}

function e_target(e) {return e.target || e.srcElement}
function e_button(e) {
  var b = e.which
  if (b == null) {
    if (e.button & 1) { b = 1 }
    else if (e.button & 2) { b = 3 }
    else if (e.button & 4) { b = 2 }
  }
  if (mac && e.ctrlKey && b == 1) { b = 3 }
  return b
}

// Detect drag-and-drop
var dragAndDrop = function() {
  // There is *some* kind of drag-and-drop support in IE6-8, but I
  // couldn't get it to work yet.
  if (ie && ie_version < 9) { return false }
  var div = elt('div')
  return "draggable" in div || "dragDrop" in div
}()

var zwspSupported
function zeroWidthElement(measure) {
  if (zwspSupported == null) {
    var test = elt("span", "\u200b")
    removeChildrenAndAdd(measure, elt("span", [test, document.createTextNode("x")]))
    if (measure.firstChild.offsetHeight != 0)
      { zwspSupported = test.offsetWidth <= 1 && test.offsetHeight > 2 && !(ie && ie_version < 8) }
  }
  var node = zwspSupported ? elt("span", "\u200b") :
    elt("span", "\u00a0", null, "display: inline-block; width: 1px; margin-right: -1px")
  node.setAttribute("cm-text", "")
  return node
}

// Feature-detect IE's crummy client rect reporting for bidi text
var badBidiRects
function hasBadBidiRects(measure) {
  if (badBidiRects != null) { return badBidiRects }
  var txt = removeChildrenAndAdd(measure, document.createTextNode("A\u062eA"))
  var r0 = range(txt, 0, 1).getBoundingClientRect()
  var r1 = range(txt, 1, 2).getBoundingClientRect()
  removeChildren(measure)
  if (!r0 || r0.left == r0.right) { return false } // Safari returns null in some cases (#2780)
  return badBidiRects = (r1.right - r0.right < 3)
}

// See if "".split is the broken IE version, if so, provide an
// alternative way to split lines.
var splitLinesAuto = "\n\nb".split(/\n/).length != 3 ? function (string) {
  var pos = 0, result = [], l = string.length
  while (pos <= l) {
    var nl = string.indexOf("\n", pos)
    if (nl == -1) { nl = string.length }
    var line = string.slice(pos, string.charAt(nl - 1) == "\r" ? nl - 1 : nl)
    var rt = line.indexOf("\r")
    if (rt != -1) {
      result.push(line.slice(0, rt))
      pos += rt + 1
    } else {
      result.push(line)
      pos = nl + 1
    }
  }
  return result
} : function (string) { return string.split(/\r\n?|\n/); }

var hasSelection = window.getSelection ? function (te) {
  try { return te.selectionStart != te.selectionEnd }
  catch(e) { return false }
} : function (te) {
  var range
  try {range = te.ownerDocument.selection.createRange()}
  catch(e) {}
  if (!range || range.parentElement() != te) { return false }
  return range.compareEndPoints("StartToEnd", range) != 0
}

var hasCopyEvent = (function () {
  var e = elt("div")
  if ("oncopy" in e) { return true }
  e.setAttribute("oncopy", "return;")
  return typeof e.oncopy == "function"
})()

var badZoomedRects = null
function hasBadZoomedRects(measure) {
  if (badZoomedRects != null) { return badZoomedRects }
  var node = removeChildrenAndAdd(measure, elt("span", "x"))
  var normal = node.getBoundingClientRect()
  var fromRange = range(node, 0, 1).getBoundingClientRect()
  return badZoomedRects = Math.abs(normal.left - fromRange.left) > 1
}

var modes = {};
var mimeModes = {};
// Extra arguments are stored as the mode's dependencies, which is
// used by (legacy) mechanisms like loadmode.js to automatically
// load a mode. (Preferred mechanism is the require/define calls.)
function defineMode(name, mode) {
  if (arguments.length > 2)
    { mode.dependencies = Array.prototype.slice.call(arguments, 2) }
  modes[name] = mode
}

function defineMIME(mime, spec) {
  mimeModes[mime] = spec
}

// Given a MIME type, a {name, ...options} config object, or a name
// string, return a mode config object.
function resolveMode(spec) {
  if (typeof spec == "string" && mimeModes.hasOwnProperty(spec)) {
    spec = mimeModes[spec]
  } else if (spec && typeof spec.name == "string" && mimeModes.hasOwnProperty(spec.name)) {
    var found = mimeModes[spec.name]
    if (typeof found == "string") { found = {name: found} }
    spec = createObj(found, spec)
    spec.name = found.name
  } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec)) {
    return resolveMode("application/xml")
  } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+json$/.test(spec)) {
    return resolveMode("application/json")
  }
  if (typeof spec == "string") { return {name: spec} }
  else { return spec || {name: "null"} }
}

// Given a mode spec (anything that resolveMode accepts), find and
// initialize an actual mode object.
function getMode(options, spec) {
  spec = resolveMode(spec)
  var mfactory = modes[spec.name]
  if (!mfactory) { return getMode(options, "text/plain") }
  var modeObj = mfactory(options, spec)
  if (modeExtensions.hasOwnProperty(spec.name)) {
    var exts = modeExtensions[spec.name]
    for (var prop in exts) {
      if (!exts.hasOwnProperty(prop)) { continue }
      if (modeObj.hasOwnProperty(prop)) { modeObj["_" + prop] = modeObj[prop] }
      modeObj[prop] = exts[prop]
    }
  }
  modeObj.name = spec.name
  if (spec.helperType) { modeObj.helperType = spec.helperType }
  if (spec.modeProps) { for (var prop$1 in spec.modeProps)
    { modeObj[prop$1] = spec.modeProps[prop$1] } }

  return modeObj
}

// This can be used to attach properties to mode objects from
// outside the actual mode definition.
var modeExtensions = {}
function extendMode(mode, properties) {
  var exts = modeExtensions.hasOwnProperty(mode) ? modeExtensions[mode] : (modeExtensions[mode] = {})
  copyObj(properties, exts)
}

function copyState(mode, state) {
  if (state === true) { return state }
  if (mode.copyState) { return mode.copyState(state) }
  var nstate = {}
  for (var n in state) {
    var val = state[n]
    if (val instanceof Array) { val = val.concat([]) }
    nstate[n] = val
  }
  return nstate
}

// Given a mode and a state (for that mode), find the inner mode and
// state at the position that the state refers to.
function innerMode(mode, state) {
  var info
  while (mode.innerMode) {
    info = mode.innerMode(state)
    if (!info || info.mode == mode) { break }
    state = info.state
    mode = info.mode
  }
  return info || {mode: mode, state: state}
}

function startState(mode, a1, a2) {
  return mode.startState ? mode.startState(a1, a2) : true
}

// STRING STREAM

// Fed to the mode parsers, provides helper functions to make
// parsers more succinct.

var StringStream = function(string, tabSize) {
  this.pos = this.start = 0
  this.string = string
  this.tabSize = tabSize || 8
  this.lastColumnPos = this.lastColumnValue = 0
  this.lineStart = 0
};
StringStream.prototype.eol = function () {return this.pos >= this.string.length};
StringStream.prototype.sol = function () {return this.pos == this.lineStart};
StringStream.prototype.peek = function () {return this.string.charAt(this.pos) || undefined};
StringStream.prototype.next = function () {
  if (this.pos < this.string.length)
    { return this.string.charAt(this.pos++) }
};
StringStream.prototype.eat = function (match) {
  var ch = this.string.charAt(this.pos)
  var ok
  if (typeof match == "string") { ok = ch == match }
  else { ok = ch && (match.test ? match.test(ch) : match(ch)) }
  if (ok) {++this.pos; return ch}
};
StringStream.prototype.eatWhile = function (match) {
  var start = this.pos
  while (this.eat(match)){}
  return this.pos > start
};
StringStream.prototype.eatSpace = function () {
    var this$1 = this;

  var start = this.pos
  while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) { ++this$1.pos }
  return this.pos > start
};
StringStream.prototype.skipToEnd = function () {this.pos = this.string.length};
StringStream.prototype.skipTo = function (ch) {
  var found = this.string.indexOf(ch, this.pos)
  if (found > -1) {this.pos = found; return true}
};
StringStream.prototype.backUp = function (n) {this.pos -= n};
StringStream.prototype.column = function () {
  if (this.lastColumnPos < this.start) {
    this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue)
    this.lastColumnPos = this.start
  }
  return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
};
StringStream.prototype.indentation = function () {
  return countColumn(this.string, null, this.tabSize) -
    (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
};
StringStream.prototype.match = function (pattern, consume, caseInsensitive) {
  if (typeof pattern == "string") {
    var cased = function (str) { return caseInsensitive ? str.toLowerCase() : str; }
    var substr = this.string.substr(this.pos, pattern.length)
    if (cased(substr) == cased(pattern)) {
      if (consume !== false) { this.pos += pattern.length }
      return true
    }
  } else {
    var match = this.string.slice(this.pos).match(pattern)
    if (match && match.index > 0) { return null }
    if (match && consume !== false) { this.pos += match[0].length }
    return match
  }
};
StringStream.prototype.current = function (){return this.string.slice(this.start, this.pos)};
StringStream.prototype.hideFirstChars = function (n, inner) {
  this.lineStart += n
  try { return inner() }
  finally { this.lineStart -= n }
};

// 计算样式数组（以模式生成开始的数组，用于失效处理，后跟结束位置和样式字符串的对），用于高亮行上的标记。
function highlightLine(cm, line, state, forceToEnd) {
  // 样式数组总是以一个数字开始，用于标识它所基于的模式/覆盖（便于失效处理）。
  var st = [cm.state.modeGen], lineClasses = {}
  // 计算基本样式数组
  runMode(cm, line.text, cm.doc.mode, state, function (end, style) { return st.push(end, style); },
    lineClasses, forceToEnd)

  // Run overlays, adjust style array.
  var loop = function ( o ) {
    var overlay = cm.state.overlays[o], i = 1, at = 0
    runMode(cm, line.text, overlay.mode, true, function (end, style) {
      var start = i
      // Ensure there's a token end at the current position, and that i points at it
      while (at < end) {
        var i_end = st[i]
        if (i_end > end)
          { st.splice(i, 1, end, st[i+1], i_end) }
        i += 2
        at = Math.min(end, i_end)
      }
      if (!style) { return }
      if (overlay.opaque) {
        st.splice(start, i - start, end, "overlay " + style)
        i = start + 2
      } else {
        for (; start < i; start += 2) {
          var cur = st[start+1]
          st[start+1] = (cur ? cur + " " : "") + "overlay " + style
        }
      }
    }, lineClasses)
  };

  for (var o = 0; o < cm.state.overlays.length; ++o) loop( o );

  return {styles: st, classes: lineClasses.bgClass || lineClasses.textClass ? lineClasses : null}
}

function getLineStyles(cm, line, updateFrontier) {
  if (!line.styles || line.styles[0] != cm.state.modeGen) {
    var state = getStateBefore(cm, lineNo(line))
    var result = highlightLine(cm, line, line.text.length > cm.options.maxHighlightLength ? copyState(cm.doc.mode, state) : state)
    line.stateAfter = state
    line.styles = result.styles
    if (result.classes) { line.styleClasses = result.classes }
    else if (line.styleClasses) { line.styleClasses = null }
    if (updateFrontier === cm.doc.frontier) { cm.doc.frontier++ }
  }
  return line.styles
}

function getStateBefore(cm, n, precise) {
  var doc = cm.doc, display = cm.display
  if (!doc.mode.startState) { return true }
  var pos = findStartLine(cm, n, precise), state = pos > doc.first && getLine(doc, pos-1).stateAfter
  if (!state) { state = startState(doc.mode) }
  else { state = copyState(doc.mode, state) }
  doc.iter(pos, n, function (line) {
    processLine(cm, line.text, state)
    var save = pos == n - 1 || pos % 5 == 0 || pos >= display.viewFrom && pos < display.viewTo
    line.stateAfter = save ? copyState(doc.mode, state) : null
    ++pos
  })
  if (precise) { doc.frontier = pos }
  return state
}

// Lightweight form of highlight -- proceed over this line and
// update state, but don't save a style array. Used for lines that
// aren't currently visible.
function processLine(cm, text, state, startAt) {
  var mode = cm.doc.mode
  var stream = new StringStream(text, cm.options.tabSize)
  stream.start = stream.pos = startAt || 0
  if (text == "") { callBlankLine(mode, state) }
  while (!stream.eol()) {
    readToken(mode, stream, state)
    stream.start = stream.pos
  }
}

function callBlankLine(mode, state) {
  if (mode.blankLine) { return mode.blankLine(state) }
  if (!mode.innerMode) { return }
  var inner = innerMode(mode, state)
  if (inner.mode.blankLine) { return inner.mode.blankLine(inner.state) }
}

function readToken(mode, stream, state, inner) {
  for (var i = 0; i < 10; i++) {
    if (inner) { inner[0] = innerMode(mode, state).mode }
    var style = mode.token(stream, state)
    if (stream.pos > stream.start) { return style }
  }
  throw new Error("Mode " + mode.name + " failed to advance stream.")
}

// Utility for getTokenAt and getLineTokens
function takeToken(cm, pos, precise, asArray) {
  var getObj = function (copy) { return ({
    start: stream.start, end: stream.pos,
    string: stream.current(),
    type: style || null,
    state: copy ? copyState(doc.mode, state) : state
  }); }

  var doc = cm.doc, mode = doc.mode, style
  pos = clipPos(doc, pos)
  var line = getLine(doc, pos.line), state = getStateBefore(cm, pos.line, precise)
  var stream = new StringStream(line.text, cm.options.tabSize), tokens
  if (asArray) { tokens = [] }
  while ((asArray || stream.pos < pos.ch) && !stream.eol()) {
    stream.start = stream.pos
    style = readToken(mode, stream, state)
    if (asArray) { tokens.push(getObj(true)) }
  }
  return asArray ? tokens : getObj()
}

function extractLineClasses(type, output) {
  if (type) { for (;;) {
    var lineClass = type.match(/(?:^|\s+)line-(background-)?(\S+)/)
    if (!lineClass) { break }
    type = type.slice(0, lineClass.index) + type.slice(lineClass.index + lineClass[0].length)
    var prop = lineClass[1] ? "bgClass" : "textClass"
    if (output[prop] == null)
      { output[prop] = lineClass[2] }
    else if (!(new RegExp("(?:^|\s)" + lineClass[2] + "(?:$|\s)")).test(output[prop]))
      { output[prop] += " " + lineClass[2] }
  } }
  return type
}

// Run the given mode's parser over a line, calling f for each token.
function runMode(cm, text, mode, state, f, lineClasses, forceToEnd) {
  var flattenSpans = mode.flattenSpans
  if (flattenSpans == null) { flattenSpans = cm.options.flattenSpans }
  var curStart = 0, curStyle = null
  var stream = new StringStream(text, cm.options.tabSize), style
  var inner = cm.options.addModeClass && [null]
  if (text == "") { extractLineClasses(callBlankLine(mode, state), lineClasses) }
  while (!stream.eol()) {
    if (stream.pos > cm.options.maxHighlightLength) {
      flattenSpans = false
      if (forceToEnd) { processLine(cm, text, state, stream.pos) }
      stream.pos = text.length
      style = null
    } else {
      style = extractLineClasses(readToken(mode, stream, state, inner), lineClasses)
    }
    if (inner) {
      var mName = inner[0].name
      if (mName) { style = "m-" + (style ? mName + " " + style : mName) }
    }
    if (!flattenSpans || curStyle != style) {
      while (curStart < stream.start) {
        curStart = Math.min(stream.start, curStart + 5000)
        f(curStart, curStyle)
      }
      curStyle = style
    }
    stream.start = stream.pos
  }
  while (curStart < stream.pos) {
    // Webkit seems to refuse to render text nodes longer than 57444
    // characters, and returns inaccurate measurements in nodes
    // starting around 5000 chars.
    var pos = Math.min(stream.pos, curStart + 5000)
    f(pos, curStyle)
    curStart = pos
  }
}

// Finds the line to start with when starting a parse. Tries to
// find a line with a stateAfter, so that it can start with a
// valid state. If that fails, it returns the line with the
// smallest indentation, which tends to need the least context to
// parse correctly.
function findStartLine(cm, n, precise) {
  var minindent, minline, doc = cm.doc
  var lim = precise ? -1 : n - (cm.doc.mode.innerMode ? 1000 : 100)
  for (var search = n; search > lim; --search) {
    if (search <= doc.first) { return doc.first }
    var line = getLine(doc, search - 1)
    if (line.stateAfter && (!precise || search <= doc.frontier)) { return search }
    var indented = countColumn(line.text, null, cm.options.tabSize)
    if (minline == null || minindent > indented) {
      minline = search - 1
      minindent = indented
    }
  }
  return minline
}

// LINE DATA STRUCTURE

// Line objects. These hold state related to a line, including
// highlighting info (the styles array).
var Line = function(text, markedSpans, estimateHeight) {
  this.text = text
  attachMarkedSpans(this, markedSpans)
  this.height = estimateHeight ? estimateHeight(this) : 1
};

Line.prototype.lineNo = function () { return lineNo(this) };
eventMixin(Line)
// 更改一行的内容（文本、标记）。自动
// 使缓存的信息失效并尝试重新估计
// 行的高度。
function updateLine(line, text, markedSpans, estimateHeight) {
  line.text = text
  if (line.stateAfter) { line.stateAfter = null }
  if (line.styles) { line.styles = null }
  if (line.order != null) { line.order = null }
  detachMarkedSpans(line)
  attachMarkedSpans(line, markedSpans)
  var estHeight = estimateHeight ? estimateHeight(line) : 1
  if (estHeight != line.height) { updateLineHeight(line, estHeight) }
}

// 从文档树和其标记中分离一行。
function cleanUpLine(line) {
  line.parent = null
  detachMarkedSpans(line)
}

// 将模式返回的样式（可能是null，或者包含一个或多个样式的字符串）
// 转换为CSS样式。这会被缓存，
// 并且还会查找行级样式。
var styleToClassCache = {};
var styleToClassCacheWithMode = {};
function interpretTokenStyle(style, options) {
  if (!style || /^\s*$/.test(style)) { return null }
  var cache = options.addModeClass ? styleToClassCacheWithMode : styleToClassCache
  return cache[style] ||
    (cache[style] = style.replace(/\S+/g, "cm-$&"))
}

// 渲染一行的文本的DOM表示。同时构建
// 一个“行映射”，它指向表示
// 特定文本段的DOM节点，并被测量代码使用。
// 返回的对象包含DOM节点、此映射，以及
// 由模式设置的行级样式的信息。
function buildLineContent(cm, lineView) {
  // padding-right 强制元素有一个“边框”，这在
  // Webkit上是必要的，以便能够获取
  // 它的行级边界矩形（在measureChar中）。
  var content = eltP("span", null, null, webkit ? "padding-right: .1px" : null)
  var builder = {pre: eltP("pre", [content], "CodeMirror-line"), content: content,
                 col: 0, pos: 0, cm: cm,
                 trailingSpace: false,
                 splitSpaces: (ie || webkit) && cm.getOption("lineWrapping")}
  lineView.measure = {}

  // 迭代构成此视觉行的逻辑行。
  for (var i = 0; i <= (lineView.rest ? lineView.rest.length : 0); i++) {
    var line = i ? lineView.rest[i - 1] : lineView.line, order = (void 0)
    builder.pos = 0
    builder.addToken = buildToken
    // 可选地将一些hack连接到token渲染
    // 算法中，以处理浏览器怪癖。
    if (hasBadBidiRects(cm.display.measure) && (order = getOrder(line, cm.doc.direction)))
      { builder.addToken = buildTokenBadBidi(builder.addToken, order) }
    builder.map = []
    var allowFrontierUpdate = lineView != cm.display.externalMeasured && lineNo(line)
    insertLineContent(line, builder, getLineStyles(cm, line, allowFrontierUpdate))
    if (line.styleClasses) {
      if (line.styleClasses.bgClass)
        { builder.bgClass = joinClasses(line.styleClasses.bgClass, builder.bgClass || "") }
      if (line.styleClasses.textClass)
        { builder.textClass = joinClasses(line.styleClasses.textClass, builder.textClass || "") }
    }

    // 确保至少有一个节点存在，用于测量。
    if (builder.map.length == 0)
      { builder.map.push(0, 0, builder.content.appendChild(zeroWidthElement(cm.display.measure))) }

    // 存储当前逻辑行的映射和缓存对象
    if (i == 0) {
      lineView.measure.map = builder.map
      lineView.measure.cache = {}
    } else {
      ;(lineView.measure.maps || (lineView.measure.maps = [])).push(builder.map)
      ;(lineView.measure.caches || (lineView.measure.caches = [])).push({})
    }
  }

  // 参见问题 #2901
  if (webkit) {
    var last = builder.content.lastChild
    if (/\bcm-tab\b/.test(last.className) || (last.querySelector && last.querySelector(".cm-tab")))
      { builder.content.className = "cm-tab-wrap-hack" }
  }

  signal(cm, "renderLine", cm, lineView.line, builder.pre)
  if (builder.pre.className)
    { builder.textClass = joinClasses(builder.pre.className, builder.textClass || "") }

  return builder
}

function defaultSpecialCharPlaceholder(ch) {
  var token = elt("span", "\u2022", "cm-invalidchar")
  token.title = "\\u" + ch.charCodeAt(0).toString(16)
  token.setAttribute("aria-label", token.title)
  return token
}

// Build up the DOM representation for a single token, and add it to
// the line map. Takes care to render special characters separately.
function buildToken(builder, text, style, startStyle, endStyle, title, css) {
  if (!text) { return }
  var displayText = builder.splitSpaces ? splitSpaces(text, builder.trailingSpace) : text
  var special = builder.cm.state.specialChars, mustWrap = false
  var content
  if (!special.test(text)) {
    builder.col += text.length
    content = document.createTextNode(displayText)
    builder.map.push(builder.pos, builder.pos + text.length, content)
    if (ie && ie_version < 9) { mustWrap = true }
    builder.pos += text.length
  } else {
    content = document.createDocumentFragment()
    var pos = 0
    while (true) {
      special.lastIndex = pos
      var m = special.exec(text)
      var skipped = m ? m.index - pos : text.length - pos
      if (skipped) {
        var txt = document.createTextNode(displayText.slice(pos, pos + skipped))
        if (ie && ie_version < 9) { content.appendChild(elt("span", [txt])) }
        else { content.appendChild(txt) }
        builder.map.push(builder.pos, builder.pos + skipped, txt)
        builder.col += skipped
        builder.pos += skipped
      }
      if (!m) { break }
      pos += skipped + 1
      var txt$1 = (void 0)
      if (m[0] == "\t") {
        var tabSize = builder.cm.options.tabSize, tabWidth = tabSize - builder.col % tabSize
        txt$1 = content.appendChild(elt("span", spaceStr(tabWidth), "cm-tab"))
        txt$1.setAttribute("role", "presentation")
        txt$1.setAttribute("cm-text", "\t")
        builder.col += tabWidth
      } else if (m[0] == "\r" || m[0] == "\n") {
        txt$1 = content.appendChild(elt("span", m[0] == "\r" ? "\u240d" : "\u2424", "cm-invalidchar"))
        txt$1.setAttribute("cm-text", m[0])
        builder.col += 1
      } else {
        txt$1 = builder.cm.options.specialCharPlaceholder(m[0])
        txt$1.setAttribute("cm-text", m[0])
        if (ie && ie_version < 9) { content.appendChild(elt("span", [txt$1])) }
        else { content.appendChild(txt$1) }
        builder.col += 1
      }
      builder.map.push(builder.pos, builder.pos + 1, txt$1)
      builder.pos++
    }
  }
  builder.trailingSpace = displayText.charCodeAt(text.length - 1) == 32
  if (style || startStyle || endStyle || mustWrap || css) {
    var fullStyle = style || ""
    if (startStyle) { fullStyle += startStyle }
    if (endStyle) { fullStyle += endStyle }
    var token = elt("span", [content], fullStyle, css)
    if (title) { token.title = title }
    return builder.content.appendChild(token)
  }
  builder.content.appendChild(content)
}

function splitSpaces(text, trailingBefore) {
  if (text.length > 1 && !/  /.test(text)) { return text }
  var spaceBefore = trailingBefore, result = ""
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i)
    if (ch == " " && spaceBefore && (i == text.length - 1 || text.charCodeAt(i + 1) == 32))
      { ch = "\u00a0" }
    result += ch
    spaceBefore = ch == " "
  }
  return result
}

// Work around nonsense dimensions being reported for stretches of
// right-to-left text.
function buildTokenBadBidi(inner, order) {
  return function (builder, text, style, startStyle, endStyle, title, css) {
    style = style ? style + " cm-force-border" : "cm-force-border"
    var start = builder.pos, end = start + text.length
    for (;;) {
      // Find the part that overlaps with the start of this text
      var part = (void 0)
      for (var i = 0; i < order.length; i++) {
        part = order[i]
        if (part.to > start && part.from <= start) { break }
      }
      if (part.to >= end) { return inner(builder, text, style, startStyle, endStyle, title, css) }
      inner(builder, text.slice(0, part.to - start), style, startStyle, null, title, css)
      startStyle = null
      text = text.slice(part.to - start)
      start = part.to
    }
  }
}

function buildCollapsedSpan(builder, size, marker, ignoreWidget) {
  var widget = !ignoreWidget && marker.widgetNode
  if (widget) { builder.map.push(builder.pos, builder.pos + size, widget) }
  if (!ignoreWidget && builder.cm.display.input.needsContentAttribute) {
    if (!widget)
      { widget = builder.content.appendChild(document.createElement("span")) }
    widget.setAttribute("cm-marker", marker.id)
  }
  if (widget) {
    builder.cm.display.input.setUneditable(widget)
    builder.content.appendChild(widget)
  }
  builder.pos += size
  builder.trailingSpace = false
}

// Outputs a number of spans to make up a line, taking highlighting
// and marked text into account.
function insertLineContent(line, builder, styles) {
  var spans = line.markedSpans, allText = line.text, at = 0
  if (!spans) {
    for (var i$1 = 1; i$1 < styles.length; i$1+=2)
      { builder.addToken(builder, allText.slice(at, at = styles[i$1]), interpretTokenStyle(styles[i$1+1], builder.cm.options)) }
    return
  }

  var len = allText.length, pos = 0, i = 1, text = "", style, css
  var nextChange = 0, spanStyle, spanEndStyle, spanStartStyle, title, collapsed
  for (;;) {
    if (nextChange == pos) { // Update current marker set
      spanStyle = spanEndStyle = spanStartStyle = title = css = ""
      collapsed = null; nextChange = Infinity
      var foundBookmarks = [], endStyles = (void 0)
      for (var j = 0; j < spans.length; ++j) {
        var sp = spans[j], m = sp.marker
        if (m.type == "bookmark" && sp.from == pos && m.widgetNode) {
          foundBookmarks.push(m)
        } else if (sp.from <= pos && (sp.to == null || sp.to > pos || m.collapsed && sp.to == pos && sp.from == pos)) {
          if (sp.to != null && sp.to != pos && nextChange > sp.to) {
            nextChange = sp.to
            spanEndStyle = ""
          }
          if (m.className) { spanStyle += " " + m.className }
          if (m.css) { css = (css ? css + ";" : "") + m.css }
          if (m.startStyle && sp.from == pos) { spanStartStyle += " " + m.startStyle }
          if (m.endStyle && sp.to == nextChange) { (endStyles || (endStyles = [])).push(m.endStyle, sp.to) }
          if (m.title && !title) { title = m.title }
          if (m.collapsed && (!collapsed || compareCollapsedMarkers(collapsed.marker, m) < 0))
            { collapsed = sp }
        } else if (sp.from > pos && nextChange > sp.from) {
          nextChange = sp.from
        }
      }
      if (endStyles) { for (var j$1 = 0; j$1 < endStyles.length; j$1 += 2)
        { if (endStyles[j$1 + 1] == nextChange) { spanEndStyle += " " + endStyles[j$1] } } }
if (!collapsed || collapsed.from == pos) { for (var j$2 = 0; j$2 < foundBookmarks.length; ++j$2)
    { buildCollapsedSpan(builder, 0, foundBookmarks[j$2]) } }
  if (collapsed && (collapsed.from || 0) == pos) {
    buildCollapsedSpan(builder, (collapsed.to == null ? len + 1 : collapsed.to) - pos,
                       collapsed.marker, collapsed.from == null)
    if (collapsed.to == null) { return }
    if (collapsed.to == pos) { collapsed = false }
  }
}
if (pos >= len) { break }

var upto = Math.min(len, nextChange)
while (true) {
  if (text) {
    var end = pos + text.length
    if (!collapsed) {
      var tokenText = end > upto ? text.slice(0, upto - pos) : text
      builder.addToken(builder, tokenText, style ? style + spanStyle : spanStyle,
                       spanStartStyle, pos + tokenText.length == nextChange ? spanEndStyle : "", title, css)
    }
    if (end >= upto) {text = text.slice(upto - pos); pos = upto; break}
    pos = end
    spanStartStyle = ""
  }
  text = allText.slice(at, at = styles[i++])
  style = interpretTokenStyle(styles[i++], builder.cm.options)
}
}


// 这些对象用于表示文档的可见（当前绘制）部分。一个LineView可能对应多个逻辑行，如果这些行由折叠范围连接。
function LineView(doc, line, lineN) {
  // 起始行
  this.line = line
  // 继续的行，如果有的话
  this.rest = visualLineContinued(line)
  // 这个可视行中的逻辑行数
  this.size = this.rest ? lineNo(lst(this.rest)) - lineN + 1 : 1
  this.node = this.text = null
  this.hidden = lineIsHidden(doc, line)
}

// 为给定的行创建一个LineView对象的范围。
function buildViewArray(cm, from, to) {
  var array = [], nextPos
  for (var pos = from; pos < to; pos = nextPos) {
    var view = new LineView(cm.doc, getLine(cm.doc, pos), pos)
    nextPos = pos + view.size
    array.push(view)
  }
  return array
}

var operationGroup = null

function pushOperation(op) {
  if (operationGroup) {
    operationGroup.ops.push(op)
  } else {
    op.ownsGroup = operationGroup = {
      ops: [op],
      delayedCallbacks: []
    }
  }
}

function fireCallbacksForOps(group) {
  // 调用延迟回调和cursorActivity处理程序，直到没有新的出现
  var callbacks = group.delayedCallbacks, i = 0
  do {
    for (; i < callbacks.length; i++)
      { callbacks[i].call(null) }
    for (var j = 0; j < group.ops.length; j++) {
      var op = group.ops[j]
      if (op.cursorActivityHandlers)
        { while (op.cursorActivityCalled < op.cursorActivityHandlers.length)
          { op.cursorActivityHandlers[op.cursorActivityCalled++].call(null, op.cm) } }
    }
  } while (i < callbacks.length)
}

function finishOperation(op, endCb) {
  var group = op.ownsGroup
  if (!group) { return }

  try { fireCallbacksForOps(group) }
  finally {
    operationGroup = null
    endCb(group)
  }
}

var orphanDelayedCallbacks = null

// 通常，我们希望在工作的中间某个点发出信号，但不希望处理程序开始调用编辑器上的其他方法，这些方法可能处于不一致的状态，或者根本不期望发生其他事件。
// signalLater检查是否有任何处理程序，并安排它们在最后一个操作结束时执行，或者，如果没有活动操作，则在超时触发时执行。
function signalLater(emitter, type /*, values...*/) {
  var arr = getHandlers(emitter, type)
  if (!arr.length) { return }
  var args = Array.prototype.slice.call(arguments, 2), list
  if (operationGroup) {
    list = operationGroup.delayedCallbacks
  } else if (orphanDelayedCallbacks) {
    list = orphanDelayedCallbacks
  } else {
    list = orphanDelayedCallbacks = []
    setTimeout(fireOrphanDelayed, 0)
  }
  var loop = function ( i ) {
    list.push(function () { return arr[i].apply(null, args); })
  };

  for (var i = 0; i < arr.length; ++i)
    loop( i );
}

function fireOrphanDelayed() {
  var delayed = orphanDelayedCallbacks
  orphanDelayedCallbacks = null
  for (var i = 0; i < delayed.length; ++i) { delayed[i]() }
}

// When an aspect of a line changes, a string is added to
// lineView.changes. This updates the relevant part of the line's
// DOM structure.
function updateLineForChanges(cm, lineView, lineN, dims) {
  for (var j = 0; j < lineView.changes.length; j++) {
    var type = lineView.changes[j]
    if (type == "text") { updateLineText(cm, lineView) }
    else if (type == "gutter") { updateLineGutter(cm, lineView, lineN, dims) }
    else if (type == "class") { updateLineClasses(cm, lineView) }
    else if (type == "widget") { updateLineWidgets(cm, lineView, dims) }
  }
  lineView.changes = null
}

// Lines with gutter elements, widgets or a background class need to
// be wrapped, and have the extra elements added to the wrapper div
function ensureLineWrapped(lineView) {
  if (lineView.node == lineView.text) {
    lineView.node = elt("div", null, null, "position: relative")
    if (lineView.text.parentNode)
      { lineView.text.parentNode.replaceChild(lineView.node, lineView.text) }
    lineView.node.appendChild(lineView.text)
    if (ie && ie_version < 8) { lineView.node.style.zIndex = 2 }
  }
  return lineView.node
}

function updateLineBackground(cm, lineView) {
  var cls = lineView.bgClass ? lineView.bgClass + " " + (lineView.line.bgClass || "") : lineView.line.bgClass
  if (cls) { cls += " CodeMirror-linebackground" }
  if (lineView.background) {
    if (cls) { lineView.background.className = cls }
    else { lineView.background.parentNode.removeChild(lineView.background); lineView.background = null }
  } else if (cls) {
    var wrap = ensureLineWrapped(lineView)
    lineView.background = wrap.insertBefore(elt("div", null, cls), wrap.firstChild)
    cm.display.input.setUneditable(lineView.background)
  }
}

// Wrapper around buildLineContent which will reuse the structure
// in display.externalMeasured when possible.
function getLineContent(cm, lineView) {
  var ext = cm.display.externalMeasured
  if (ext && ext.line == lineView.line) {
    cm.display.externalMeasured = null
    lineView.measure = ext.measure
    return ext.built
  }
  return buildLineContent(cm, lineView)
}

// Redraw the line's text. Interacts with the background and text
// classes because the mode may output tokens that influence these
// classes.
function updateLineText(cm, lineView) {
  var cls = lineView.text.className
  var built = getLineContent(cm, lineView)
  if (lineView.text == lineView.node) { lineView.node = built.pre }
  lineView.text.parentNode.replaceChild(built.pre, lineView.text)
  lineView.text = built.pre
  if (built.bgClass != lineView.bgClass || built.textClass != lineView.textClass) {
    lineView.bgClass = built.bgClass
    lineView.textClass = built.textClass
    updateLineClasses(cm, lineView)
  } else if (cls) {
    lineView.text.className = cls
  }
}

function updateLineClasses(cm, lineView) {
  updateLineBackground(cm, lineView)
  if (lineView.line.wrapClass)
    { ensureLineWrapped(lineView).className = lineView.line.wrapClass }
  else if (lineView.node != lineView.text)
    { lineView.node.className = "" }
  var textClass = lineView.textClass ? lineView.textClass + " " + (lineView.line.textClass || "") : lineView.line.textClass
  lineView.text.className = textClass || ""
}

function updateLineGutter(cm, lineView, lineN, dims) {
  if (lineView.gutter) {
    lineView.node.removeChild(lineView.gutter)
    lineView.gutter = null
  }
  if (lineView.gutterBackground) {
    lineView.node.removeChild(lineView.gutterBackground)
    lineView.gutterBackground = null
  }
  if (lineView.line.gutterClass) {
    var wrap = ensureLineWrapped(lineView)
    lineView.gutterBackground = elt("div", null, "CodeMirror-gutter-background " + lineView.line.gutterClass,
                                    ("left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px; width: " + (dims.gutterTotalWidth) + "px"))
    cm.display.input.setUneditable(lineView.gutterBackground)
    wrap.insertBefore(lineView.gutterBackground, lineView.text)
  }
  var markers = lineView.line.gutterMarkers
  if (cm.options.lineNumbers || markers) {
    var wrap$1 = ensureLineWrapped(lineView)
    var gutterWrap = lineView.gutter = elt("div", null, "CodeMirror-gutter-wrapper", ("left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px"))
    cm.display.input.setUneditable(gutterWrap)
    wrap$1.insertBefore(gutterWrap, lineView.text)
    if (lineView.line.gutterClass)
      { gutterWrap.className += " " + lineView.line.gutterClass }
    if (cm.options.lineNumbers && (!markers || !markers["CodeMirror-linenumbers"]))
      { lineView.lineNumber = gutterWrap.appendChild(
        elt("div", lineNumberFor(cm.options, lineN),
            "CodeMirror-linenumber CodeMirror-gutter-elt",
            ("left: " + (dims.gutterLeft["CodeMirror-linenumbers"]) + "px; width: " + (cm.display.lineNumInnerWidth) + "px"))) }
    if (markers) { for (var k = 0; k < cm.options.gutters.length; ++k) {
      var id = cm.options.gutters[k], found = markers.hasOwnProperty(id) && markers[id]
      if (found)
        { gutterWrap.appendChild(elt("div", [found], "CodeMirror-gutter-elt",
                                   ("left: " + (dims.gutterLeft[id]) + "px; width: " + (dims.gutterWidth[id]) + "px"))) }
    } }
  }
}

function updateLineWidgets(cm, lineView, dims) {
  if (lineView.alignable) { lineView.alignable = null }
  for (var node = lineView.node.firstChild, next = (void 0); node; node = next) {
    next = node.nextSibling
    if (node.className == "CodeMirror-linewidget")
      { lineView.node.removeChild(node) }
  }
  insertLineWidgets(cm, lineView, dims)
}

// Build a line's DOM representation from scratch
function buildLineElement(cm, lineView, lineN, dims) {
  var built = getLineContent(cm, lineView)
  lineView.text = lineView.node = built.pre
  if (built.bgClass) { lineView.bgClass = built.bgClass }
  if (built.textClass) { lineView.textClass = built.textClass }

  updateLineClasses(cm, lineView)
  updateLineGutter(cm, lineView, lineN, dims)
  insertLineWidgets(cm, lineView, dims)
  return lineView.node
}

// A lineView may contain multiple logical lines (when merged by
// collapsed spans). The widgets for all of them need to be drawn.
function insertLineWidgets(cm, lineView, dims) {
  insertLineWidgetsFor(cm, lineView.line, lineView, dims, true)
  if (lineView.rest) { for (var i = 0; i < lineView.rest.length; i++)
    { insertLineWidgetsFor(cm, lineView.rest[i], lineView, dims, false) } }
}

function insertLineWidgetsFor(cm, line, lineView, dims, allowAbove) {
  if (!line.widgets) { return }
  var wrap = ensureLineWrapped(lineView)
  for (var i = 0, ws = line.widgets; i < ws.length; ++i) {
    var widget = ws[i], node = elt("div", [widget.node], "CodeMirror-linewidget")
    if (!widget.handleMouseEvents) { node.setAttribute("cm-ignore-events", "true") }
    positionLineWidget(widget, node, lineView, dims)
    cm.display.input.setUneditable(node)
    if (allowAbove && widget.above)
      { wrap.insertBefore(node, lineView.gutter || lineView.text) }
    else
      { wrap.appendChild(node) }
    signalLater(widget, "redraw")
  }
}

function positionLineWidget(widget, node, lineView, dims) {
  if (widget.noHScroll) {
    ;(lineView.alignable || (lineView.alignable = [])).push(node)
    var width = dims.wrapperWidth
    node.style.left = dims.fixedPos + "px"
    if (!widget.coverGutter) {
      width -= dims.gutterTotalWidth
      node.style.paddingLeft = dims.gutterTotalWidth + "px"
    }
    node.style.width = width + "px"
  }
  if (widget.coverGutter) {
    node.style.zIndex = 5
    node.style.position = "relative"
    if (!widget.noHScroll) { node.style.marginLeft = -dims.gutterTotalWidth + "px" }
  }
}

function widgetHeight(widget) {
  if (widget.height != null) { return widget.height }
  var cm = widget.doc.cm
  if (!cm) { return 0 }
  if (!contains(document.body, widget.node)) {
    var parentStyle = "position: relative;"
    if (widget.coverGutter)
      { parentStyle += "margin-left: -" + cm.display.gutters.offsetWidth + "px;" }
    if (widget.noHScroll)
      { parentStyle += "width: " + cm.display.wrapper.clientWidth + "px;" }
    removeChildrenAndAdd(cm.display.measure, elt("div", [widget.node], null, parentStyle))
  }
  return widget.height = widget.node.parentNode.offsetHeight
}

// Return true when the given mouse event happened in a widget
function eventInWidget(display, e) {
  for (var n = e_target(e); n != display.wrapper; n = n.parentNode) {
    if (!n || (n.nodeType == 1 && n.getAttribute("cm-ignore-events") == "true") ||
        (n.parentNode == display.sizer && n != display.mover))
      { return true }
  }
}

// POSITION MEASUREMENT

function paddingTop(display) {return display.lineSpace.offsetTop}
function paddingVert(display) {return display.mover.offsetHeight - display.lineSpace.offsetHeight}
function paddingH(display) {
  if (display.cachedPaddingH) { return display.cachedPaddingH }
  var e = removeChildrenAndAdd(display.measure, elt("pre", "x"))
  var style = window.getComputedStyle ? window.getComputedStyle(e) : e.currentStyle
  var data = {left: parseInt(style.paddingLeft), right: parseInt(style.paddingRight)}
  if (!isNaN(data.left) && !isNaN(data.right)) { display.cachedPaddingH = data }
  return data
}

function scrollGap(cm) { return scrollerGap - cm.display.nativeBarWidth }
function displayWidth(cm) {
  return cm.display.scroller.clientWidth - scrollGap(cm) - cm.display.barWidth
}
function displayHeight(cm) {
  return cm.display.scroller.clientHeight - scrollGap(cm) - cm.display.barHeight
}

// Ensure the lineView.wrapping.heights array is populated. This is
// an array of bottom offsets for the lines that make up a drawn
// line. When lineWrapping is on, there might be more than one
// height.
function ensureLineHeights(cm, lineView, rect) {
  var wrapping = cm.options.lineWrapping
  var curWidth = wrapping && displayWidth(cm)
  if (!lineView.measure.heights || wrapping && lineView.measure.width != curWidth) {
    var heights = lineView.measure.heights = []
    if (wrapping) {
      lineView.measure.width = curWidth
      var rects = lineView.text.firstChild.getClientRects()
      for (var i = 0; i < rects.length - 1; i++) {
        var cur = rects[i], next = rects[i + 1]
        if (Math.abs(cur.bottom - next.bottom) > 2)
          { heights.push((cur.bottom + next.top) / 2 - rect.top) }
      }
    }
    heights.push(rect.bottom - rect.top)
  }
}

// Find a line map (mapping character offsets to text nodes) and a
// measurement cache for the given line number. (A line view might
// contain multiple lines when collapsed ranges are present.)
function mapFromLineView(lineView, line, lineN) {
  if (lineView.line == line)
    { return {map: lineView.measure.map, cache: lineView.measure.cache} }
  for (var i = 0; i < lineView.rest.length; i++)
    { if (lineView.rest[i] == line)
      { return {map: lineView.measure.maps[i], cache: lineView.measure.caches[i]} } }
  for (var i$1 = 0; i$1 < lineView.rest.length; i$1++)
    { if (lineNo(lineView.rest[i$1]) > lineN)
      { return {map: lineView.measure.maps[i$1], cache: lineView.measure.caches[i$1], before: true} } }
}

// Render a line into the hidden node display.externalMeasured. Used
// when measurement is needed for a line that's not in the viewport.
function updateExternalMeasurement(cm, line) {
  line = visualLine(line)
  var lineN = lineNo(line)
  var view = cm.display.externalMeasured = new LineView(cm.doc, line, lineN)
  view.lineN = lineN
  var built = view.built = buildLineContent(cm, view)
  view.text = built.pre
  removeChildrenAndAdd(cm.display.lineMeasure, built.pre)
  return view
}

// Get a {top, bottom, left, right} box (in line-local coordinates)
// for a given character.
function measureChar(cm, line, ch, bias) {
  return measureCharPrepared(cm, prepareMeasureForLine(cm, line), ch, bias)
}

// Find a line view that corresponds to the given line number.
function findViewForLine(cm, lineN) {
  if (lineN >= cm.display.viewFrom && lineN < cm.display.viewTo)
    { return cm.display.view[findViewIndex(cm, lineN)] }
  var ext = cm.display.externalMeasured
  if (ext && lineN >= ext.lineN && lineN < ext.lineN + ext.size)
    { return ext }
}

// Measurement can be split in two steps, the set-up work that
// applies to the whole line, and the measurement of the actual
// character. Functions like coordsChar, that need to do a lot of
// measurements in a row, can thus ensure that the set-up work is
// only done once.
function prepareMeasureForLine(cm, line) {
  var lineN = lineNo(line)
  var view = findViewForLine(cm, lineN)
  if (view && !view.text) {
    view = null
  } else if (view && view.changes) {
    updateLineForChanges(cm, view, lineN, getDimensions(cm))
    cm.curOp.forceUpdate = true
  }
  if (!view)
    { view = updateExternalMeasurement(cm, line) }

  var info = mapFromLineView(view, line, lineN)
  return {
    line: line, view: view, rect: null,
    map: info.map, cache: info.cache, before: info.before,
    hasHeights: false
  }
}
// 给定一个准备好的测量对象，测量实际字符的位置（或从缓存中获取）。
function measureCharPrepared(cm, prepared, ch, bias, varHeight) {
  if (prepared.before) { ch = -1 }
  var key = ch + (bias || ""), found
  if (prepared.cache.hasOwnProperty(key)) {
    found = prepared.cache[key]
  } else {
    if (!prepared.rect)
      { prepared.rect = prepared.view.text.getBoundingClientRect() }
    if (!prepared.hasHeights) {
      ensureLineHeights(cm, prepared.view, prepared.rect)
      prepared.hasHeights = true
    }
    found = measureCharInner(cm, prepared, ch, bias)
    if (!found.bogus) { prepared.cache[key] = found }
  }
  return {left: found.left, right: found.right,
          top: varHeight ? found.rtop : found.top,
          bottom: varHeight ? found.rbottom : found.bottom}
}

var nullRect = {left: 0, right: 0, top: 0, bottom: 0}

function nodeAndOffsetInLineMap(map, ch, bias) {
  var node, start, end, collapse, mStart, mEnd
  // 首先，在行映射中搜索与目标字符对应或最接近的文本节点。
  for (var i = 0; i < map.length; i += 3) {
    mStart = map[i]
    mEnd = map[i + 1]
    if (ch < mStart) {
      start = 0; end = 1
      collapse = "left"
    } else if (ch < mEnd) {
      start = ch - mStart
      end = start + 1
    } else if (i == map.length - 3 || ch == mEnd && map[i + 3] > ch) {
      end = mEnd - mStart
      start = end - 1
      if (ch >= mEnd) { collapse = "right" }
    }
    if (start != null) {
      node = map[i + 2]
      if (mStart == mEnd && bias == (node.insertLeft ? "left" : "right"))
        { collapse = bias }
      if (bias == "left" && start == 0)
        { while (i && map[i - 2] == map[i - 3] && map[i - 1].insertLeft) {
          node = map[(i -= 3) + 2]
          collapse = "left"
        } }
      if (bias == "right" && start == mEnd - mStart)
        { while (i < map.length - 3 && map[i + 3] == map[i + 4] && !map[i + 5].insertLeft) {
          node = map[(i += 3) + 2]
          collapse = "right"
        } }
      break
    }
  }
  return {node: node, start: start, end: end, collapse: collapse, coverStart: mStart, coverEnd: mEnd}
}

function getUsefulRect(rects, bias) {
  var rect = nullRect
  if (bias == "left") { for (var i = 0; i < rects.length; i++) {
    if ((rect = rects[i]).left != rect.right) { break }
  } } else { for (var i$1 = rects.length - 1; i$1 >= 0; i$1--) {
    if ((rect = rects[i$1]).left != rect.right) { break }
  } }
  return rect
}

function measureCharInner(cm, prepared, ch, bias) {
  var place = nodeAndOffsetInLineMap(prepared.map, ch, bias)
  var node = place.node, start = place.start, end = place.end, collapse = place.collapse

  var rect
  if (node.nodeType == 3) { // If it is a text node, use a range to retrieve the coordinates.
    for (var i$1 = 0; i$1 < 4; i$1++) { // Retry a maximum of 4 times when nonsense rectangles are returned
      while (start && isExtendingChar(prepared.line.text.charAt(place.coverStart + start))) { --start }
      while (place.coverStart + end < place.coverEnd && isExtendingChar(prepared.line.text.charAt(place.coverStart + end))) { ++end }
      if (ie && ie_version < 9 && start == 0 && end == place.coverEnd - place.coverStart)
        { rect = node.parentNode.getBoundingClientRect() }
      else
        { rect = getUsefulRect(range(node, start, end).getClientRects(), bias) }
      if (rect.left || rect.right || start == 0) { break }
      end = start
      start = start - 1
      collapse = "right"
    }
    if (ie && ie_version < 11) { rect = maybeUpdateRectForZooming(cm.display.measure, rect) }
  } else { // If it is a widget, simply get the box for the whole widget.
    if (start > 0) { collapse = bias = "right" }
    var rects
    if (cm.options.lineWrapping && (rects = node.getClientRects()).length > 1)
      { rect = rects[bias == "right" ? rects.length - 1 : 0] }
    else
      { rect = node.getBoundingClientRect() }
  }
  if (ie && ie_version < 9 && !start && (!rect || !rect.left && !rect.right)) {
    var rSpan = node.parentNode.getClientRects()[0]
    if (rSpan)
      { rect = {left: rSpan.left, right: rSpan.left + charWidth(cm.display), top: rSpan.top, bottom: rSpan.bottom} }
    else
      { rect = nullRect }
  }

  var rtop = rect.top - prepared.rect.top, rbot = rect.bottom - prepared.rect.top
  var mid = (rtop + rbot) / 2
  var heights = prepared.view.measure.heights
  var i = 0
  for (; i < heights.length - 1; i++)
    { if (mid < heights[i]) { break } }
  var top = i ? heights[i - 1] : 0, bot = heights[i]
  var result = {left: (collapse == "right" ? rect.right : rect.left) - prepared.rect.left,
                right: (collapse == "left" ? rect.left : rect.right) - prepared.rect.left,
                top: top, bottom: bot}
  if (!rect.left && !rect.right) { result.bogus = true }
  if (!cm.options.singleCursorHeightPerLine) { result.rtop = rtop; result.rbottom = rbot }

  return result
}

// Work around problem with bounding client rects on ranges being
// returned incorrectly when zoomed on IE10 and below.
function maybeUpdateRectForZooming(measure, rect) {
  if (!window.screen || screen.logicalXDPI == null ||
      screen.logicalXDPI == screen.deviceXDPI || !hasBadZoomedRects(measure))
    { return rect }
  var scaleX = screen.logicalXDPI / screen.deviceXDPI
  var scaleY = screen.logicalYDPI / screen.deviceYDPI
  return {left: rect.left * scaleX, right: rect.right * scaleX,
          top: rect.top * scaleY, bottom: rect.bottom * scaleY}
}

function clearLineMeasurementCacheFor(lineView) {
  if (lineView.measure) {
    lineView.measure.cache = {}
    lineView.measure.heights = null
    if (lineView.rest) { for (var i = 0; i < lineView.rest.length; i++)
      { lineView.measure.caches[i] = {} } }
  }
}

function clearLineMeasurementCache(cm) {
  cm.display.externalMeasure = null
  removeChildren(cm.display.lineMeasure)
  for (var i = 0; i < cm.display.view.length; i++)
    { clearLineMeasurementCacheFor(cm.display.view[i]) }
}

function clearCaches(cm) {
  clearLineMeasurementCache(cm)
  cm.display.cachedCharWidth = cm.display.cachedTextHeight = cm.display.cachedPaddingH = null
  if (!cm.options.lineWrapping) { cm.display.maxLineChanged = true }
  cm.display.lineNumChars = null
}

function pageScrollX() {
  // Work around https://bugs.chromium.org/p/chromium/issues/detail?id=489206
  // which causes page_Offset and bounding client rects to use
  // different reference viewports and invalidate our calculations.
  if (chrome && android) { return -(document.body.getBoundingClientRect().left - parseInt(getComputedStyle(document.body).marginLeft)) }
  return window.pageXOffset || (document.documentElement || document.body).scrollLeft
}
function pageScrollY() {
  if (chrome && android) { return -(document.body.getBoundingClientRect().top - parseInt(getComputedStyle(document.body).marginTop)) }
  return window.pageYOffset || (document.documentElement || document.body).scrollTop
}

// Converts a {top, bottom, left, right} box from line-local
// coordinates into another coordinate system. Context may be one of
// "line", "div" (display.lineDiv), "local"./null (editor), "window",
// or "page".
function intoCoordSystem(cm, lineObj, rect, context, includeWidgets) {
  if (!includeWidgets && lineObj.widgets) { for (var i = 0; i < lineObj.widgets.length; ++i) { if (lineObj.widgets[i].above) {
    var size = widgetHeight(lineObj.widgets[i])
    rect.top += size; rect.bottom += size
  } } }
  if (context == "line") { return rect }
  if (!context) { context = "local" }
  var yOff = heightAtLine(lineObj)
  if (context == "local") { yOff += paddingTop(cm.display) }
  else { yOff -= cm.display.viewOffset }
  if (context == "page" || context == "window") {
    var lOff = cm.display.lineSpace.getBoundingClientRect()
    yOff += lOff.top + (context == "window" ? 0 : pageScrollY())
    var xOff = lOff.left + (context == "window" ? 0 : pageScrollX())
    rect.left += xOff; rect.right += xOff
  }
  rect.top += yOff; rect.bottom += yOff
  return rect
}

// Coverts a box from "div" coords to another coordinate system.
// Context may be "window", "page", "div", or "local"./null.
function fromCoordSystem(cm, coords, context) {
  if (context == "div") { return coords }
  var left = coords.left, top = coords.top
  // First move into "page" coordinate system
  if (context == "page") {
    left -= pageScrollX()
    top -= pageScrollY()
  } else if (context == "local" || !context) {
    var localBox = cm.display.sizer.getBoundingClientRect()
    left += localBox.left
    top += localBox.top
  }

  var lineSpaceBox = cm.display.lineSpace.getBoundingClientRect()
  return {left: left - lineSpaceBox.left, top: top - lineSpaceBox.top}
}

function charCoords(cm, pos, context, lineObj, bias) {
  if (!lineObj) { lineObj = getLine(cm.doc, pos.line) }
  return intoCoordSystem(cm, lineObj, measureChar(cm, lineObj, pos.ch, bias), context)
}

// Returns a box for a given cursor position, which may have an
// 'other' property containing the position of the secondary cursor
// on a bidi boundary.
// A cursor Pos(line, char, "before") is on the same visual line as `char - 1`
// and after `char - 1` in writing order of `char - 1`
// A cursor Pos(line, char, "after") is on the same visual line as `char`
// and before `char` in writing order of `char`
// Examples (upper-case letters are RTL, lower-case are LTR):
//     Pos(0, 1, ...)
//     before   after
// ab     a|b     a|b
// aB     a|B     aB|
// Ab     |Ab     A|b
// AB     B|A     B|A
// Every position after the last character on a line is considered to stick
// to the last character on the line.
function cursorCoords(cm, pos, context, lineObj, preparedMeasure, varHeight) {
  lineObj = lineObj || getLine(cm.doc, pos.line)
  if (!preparedMeasure) { preparedMeasure = prepareMeasureForLine(cm, lineObj) }
  function get(ch, right) {
    var m = measureCharPrepared(cm, preparedMeasure, ch, right ? "right" : "left", varHeight)
    if (right) { m.left = m.right; } else { m.right = m.left }
    return intoCoordSystem(cm, lineObj, m, context)
  }
  var order = getOrder(lineObj, cm.doc.direction), ch = pos.ch, sticky = pos.sticky
  if (ch >= lineObj.text.length) {
    ch = lineObj.text.length
    sticky = "before"
  } else if (ch <= 0) {
    ch = 0
    sticky = "after"
  }
  if (!order) { return get(sticky == "before" ? ch - 1 : ch, sticky == "before") }

  function getBidi(ch, partPos, invert) {
    var part = order[partPos], right = (part.level % 2) != 0
    return get(invert ? ch - 1 : ch, right != invert)
  }
  var partPos = getBidiPartAt(order, ch, sticky)
  var other = bidiOther
  var val = getBidi(ch, partPos, sticky == "before")
  if (other != null) { val.other = getBidi(ch, other, sticky != "before") }
  return val
}

// Used to cheaply estimate the coordinates for a position. Used for
// intermediate scroll updates.
function estimateCoords(cm, pos) {
  var left = 0
  pos = clipPos(cm.doc, pos)
  if (!cm.options.lineWrapping) { left = charWidth(cm.display) * pos.ch }
  var lineObj = getLine(cm.doc, pos.line)
  var top = heightAtLine(lineObj) + paddingTop(cm.display)
  return {left: left, right: left, top: top, bottom: top + lineObj.height}
}

// Positions returned by coordsChar contain some extra information.
// xRel is the relative x position of the input coordinates compared
// to the found position (so xRel > 0 means the coordinates are to
// the right of the character position, for example). When outside
// is true, that means the coordinates lie outside the line's
// vertical range.
function PosWithInfo(line, ch, sticky, outside, xRel) {
  var pos = Pos(line, ch, sticky)
  pos.xRel = xRel
  if (outside) { pos.outside = true }
  return pos
}

// Compute the character position closest to the given coordinates.
// Input must be lineSpace-local ("div" coordinate system).
function coordsChar(cm, x, y) {
  var doc = cm.doc
  y += cm.display.viewOffset
  if (y < 0) { return PosWithInfo(doc.first, 0, null, true, -1) }
  var lineN = lineAtHeight(doc, y), last = doc.first + doc.size - 1
  if (lineN > last)
    { return PosWithInfo(doc.first + doc.size - 1, getLine(doc, last).text.length, null, true, 1) }
  if (x < 0) { x = 0 }

  var lineObj = getLine(doc, lineN)
  for (;;) {
    var found = coordsCharInner(cm, lineObj, lineN, x, y)
    var merged = collapsedSpanAtEnd(lineObj)
    var mergedPos = merged && merged.find(0, true)
    if (merged && (found.ch > mergedPos.from.ch || found.ch == mergedPos.from.ch && found.xRel > 0))
      { lineN = lineNo(lineObj = mergedPos.to.line) }
    else
      { return found }
  }
}

function wrappedLineExtent(cm, lineObj, preparedMeasure, y) {
  var measure = function (ch) { return intoCoordSystem(cm, lineObj, measureCharPrepared(cm, preparedMeasure, ch), "line"); }
  var end = lineObj.text.length
  var begin = findFirst(function (ch) { return measure(ch - 1).bottom <= y; }, end, 0)
  end = findFirst(function (ch) { return measure(ch).top > y; }, begin, end)
  return {begin: begin, end: end}
}

function wrappedLineExtentChar(cm, lineObj, preparedMeasure, target) {
  var targetTop = intoCoordSystem(cm, lineObj, measureCharPrepared(cm, preparedMeasure, target), "line").top
  return wrappedLineExtent(cm, lineObj, preparedMeasure, targetTop)
}

function coordsCharInner(cm, lineObj, lineNo, x, y) {
  y -= heightAtLine(lineObj)
  var begin = 0, end = lineObj.text.length
  var preparedMeasure = prepareMeasureForLine(cm, lineObj)
  var pos
  var order = getOrder(lineObj, cm.doc.direction)
  if (order) {
    if (cm.options.lineWrapping) {
      ;var assign;
      ((assign = wrappedLineExtent(cm, lineObj, preparedMeasure, y), begin = assign.begin, end = assign.end, assign))
    }
    pos = new Pos(lineNo, begin)
    var beginLeft = cursorCoords(cm, pos, "line", lineObj, preparedMeasure).left
    var dir = beginLeft < x ? 1 : -1
    var prevDiff, diff = beginLeft - x, prevPos
    do {
      prevDiff = diff
      prevPos = pos
      pos = moveVisually(cm, lineObj, pos, dir)
      if (pos == null || pos.ch < begin || end <= (pos.sticky == "before" ? pos.ch - 1 : pos.ch)) {
        pos = prevPos
        break
      }
      diff = cursorCoords(cm, pos, "line", lineObj, preparedMeasure).left - x
    } while ((dir < 0) != (diff < 0) && (Math.abs(diff) <= Math.abs(prevDiff)))
    if (Math.abs(diff) > Math.abs(prevDiff)) {
      if ((diff < 0) == (prevDiff < 0)) { throw new Error("Broke out of infinite loop in coordsCharInner") }
      pos = prevPos
    }
  } else {
    var ch = findFirst(function (ch) {
      var box = intoCoordSystem(cm, lineObj, measureCharPrepared(cm, preparedMeasure, ch), "line")
      if (box.top > y) {
        // For the cursor stickiness
        end = Math.min(ch, end)
        return true
      }
      else if (box.bottom <= y) { return false }
      else if (box.left > x) { return true }
      else if (box.right < x) { return false }
      else { return (x - box.left < box.right - x) }
    }, begin, end)
    ch = skipExtendingChars(lineObj.text, ch, 1)
    pos = new Pos(lineNo, ch, ch == end ? "before" : "after")
  }
  var coords = cursorCoords(cm, pos, "line", lineObj, preparedMeasure)
  if (y < coords.top || coords.bottom < y) { pos.outside = true }
  pos.xRel = x < coords.left ? -1 : (x > coords.right ? 1 : 0)
  return pos
}

var measureText
// Compute the default text height.
function textHeight(display) {
  if (display.cachedTextHeight != null) { return display.cachedTextHeight }
  if (measureText == null) {
    measureText = elt("pre")
    // Measure a bunch of lines, for browsers that compute
    // fractional heights.
    for (var i = 0; i < 49; ++i) {
      measureText.appendChild(document.createTextNode("x"))
      measureText.appendChild(elt("br"))
    }
    measureText.appendChild(document.createTextNode("x"))
  }
  removeChildrenAndAdd(display.measure, measureText)
  var height = measureText.offsetHeight / 50
  if (height > 3) { display.cachedTextHeight = height }
  removeChildren(display.measure)
  return height || 1
}

// Compute the default character width.
function charWidth(display) {
  if (display.cachedCharWidth != null) { return display.cachedCharWidth }
  var anchor = elt("span", "xxxxxxxxxx")
  var pre = elt("pre", [anchor])
  removeChildrenAndAdd(display.measure, pre)
  var rect = anchor.getBoundingClientRect(), width = (rect.right - rect.left) / 10
  if (width > 2) { display.cachedCharWidth = width }
  return width || 10
}
// 对需要绘制视图的 DOM 位置和尺寸进行批量读取，以避免在 DOM 中交替进行读取和写入操作。
function getDimensions(cm) {
  var d = cm.display, left = {}, width = {}
  var gutterLeft = d.gutters.clientLeft
  for (var n = d.gutters.firstChild, i = 0; n; n = n.nextSibling, ++i) {
    left[cm.options.gutters[i]] = n.offsetLeft + n.clientLeft + gutterLeft
    width[cm.options.gutters[i]] = n.clientWidth
  }
  return {fixedPos: compensateForHScroll(d),
          gutterTotalWidth: d.gutters.offsetWidth,
          gutterLeft: left,
          gutterWidth: width,
          wrapperWidth: d.wrapper.clientWidth}
}

// 计算 display.scroller.scrollLeft + display.gutters.offsetWidth，
// 但使用 getBoundingClientRect 来获得亚像素精确的结果。
function compensateForHScroll(display) {
  return display.scroller.getBoundingClientRect().left - display.sizer.getBoundingClientRect().left
}

// 返回一个函数，用于估计行的高度，在行变得可见（因此可以正确测量）之前作为第一近似值使用。
function estimateHeight(cm) {
  var th = textHeight(cm.display), wrapping = cm.options.lineWrapping
  var perLine = wrapping && Math.max(5, cm.display.scroller.clientWidth / charWidth(cm.display) - 3)
  return function (line) {
    if (lineIsHidden(cm.doc, line)) { return 0 }

    var widgetsHeight = 0
    if (line.widgets) { for (var i = 0; i < line.widgets.length; i++) {
      if (line.widgets[i].height) { widgetsHeight += line.widgets[i].height }
    } }

    if (wrapping)
      { return widgetsHeight + (Math.ceil(line.text.length / perLine) || 1) * th }
    else
      { return widgetsHeight + th }
  }
}

function estimateLineHeights(cm) {
  var doc = cm.doc, est = estimateHeight(cm)
  doc.iter(function (line) {
    var estHeight = est(line)
    if (estHeight != line.height) { updateLineHeight(line, estHeight) }
  })
}

// 给定一个鼠标事件，找到相应的位置。如果 liberal 为 false，它会检查是否点击了槽或滚动条，
// 如果是，则返回 null。forRect 由矩形选择使用，并尝试即使对于文本右侧的坐标也估计一个字符位置。
function posFromMouse(cm, e, liberal, forRect) {
  var display = cm.display
  if (!liberal && e_target(e).getAttribute("cm-not-content") == "true") { return null }

  var x, y, space = display.lineSpace.getBoundingClientRect()
  // 在 IE[67] 上，当鼠标快速拖动时，可能会不可预测地失败。
  try { x = e.clientX - space.left; y = e.clientY - space.top }
  catch (e) { return null }
  var coords = coordsChar(cm, x, y), line
  if (forRect && coords.xRel == 1 && (line = getLine(cm.doc, coords.line).text).length == coords.ch) {
    var colDiff = countColumn(line, line.length, cm.options.tabSize) - line.length
    coords = Pos(coords.line, Math.max(0, Math.round((x - paddingH(cm.display).left) / charWidth(cm.display)) - colDiff))
  }
  return coords
}

// 查找与给定行对应的视图元素。当行不可见时返回 null。
function findViewIndex(cm, n) {
  if (n >= cm.display.viewTo) { return null }
  n -= cm.display.viewFrom
  if (n < 0) { return null }
  var view = cm.display.view
  for (var i = 0; i < view.length; i++) {
    n -= view[i].size
    if (n < 0) { return i }
  }
}

function updateSelection(cm) {
  cm.display.input.showSelection(cm.display.input.prepareSelection())
}

function prepareSelection(cm, primary) {
  var doc = cm.doc, result = {}
  var curFragment = result.cursors = document.createDocumentFragment()
  var selFragment = result.selection = document.createDocumentFragment()

  for (var i = 0; i < doc.sel.ranges.length; i++) {
    if (primary === false && i == doc.sel.primIndex) { continue }
    var range = doc.sel.ranges[i]
    if (range.from().line >= cm.display.viewTo || range.to().line < cm.display.viewFrom) { continue }
    var collapsed = range.empty()
    if (collapsed || cm.options.showCursorWhenSelecting)
      { drawSelectionCursor(cm, range.head, curFragment) }
    if (!collapsed)
      { drawSelectionRange(cm, range, selFragment) }
  }
  return result
}

// Draws a cursor for the given range
function drawSelectionCursor(cm, head, output) {
  var pos = cursorCoords(cm, head, "div", null, null, !cm.options.singleCursorHeightPerLine)

  var cursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor"))
  cursor.style.left = pos.left + "px"
  cursor.style.top = pos.top + "px"
  cursor.style.height = Math.max(0, pos.bottom - pos.top) * cm.options.cursorHeight + "px"

  if (pos.other) {
    // Secondary cursor, shown when on a 'jump' in bi-directional text
    var otherCursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor CodeMirror-secondarycursor"))
    otherCursor.style.display = ""
    otherCursor.style.left = pos.other.left + "px"
    otherCursor.style.top = pos.other.top + "px"
    otherCursor.style.height = (pos.other.bottom - pos.other.top) * .85 + "px"
  }
}

// Draws the given range as a highlighted selection
function drawSelectionRange(cm, range, output) {
  var display = cm.display, doc = cm.doc
  var fragment = document.createDocumentFragment()
  var padding = paddingH(cm.display), leftSide = padding.left
  var rightSide = Math.max(display.sizerWidth, displayWidth(cm) - display.sizer.offsetLeft) - padding.right

  function add(left, top, width, bottom) {
    if (top < 0) { top = 0 }
    top = Math.round(top)
    bottom = Math.round(bottom)
    fragment.appendChild(elt("div", null, "CodeMirror-selected", ("position: absolute; left: " + left + "px;\n                             top: " + top + "px; width: " + (width == null ? rightSide - left : width) + "px;\n                             height: " + (bottom - top) + "px")))
  }

  function drawForLine(line, fromArg, toArg) {
    var lineObj = getLine(doc, line)
    var lineLen = lineObj.text.length
    var start, end
    function coords(ch, bias) {
      return charCoords(cm, Pos(line, ch), "div", lineObj, bias)
    }

    iterateBidiSections(getOrder(lineObj, doc.direction), fromArg || 0, toArg == null ? lineLen : toArg, function (from, to, dir) {
      var leftPos = coords(from, "left"), rightPos, left, right
      if (from == to) {
        rightPos = leftPos
        left = right = leftPos.left
      } else {
        rightPos = coords(to - 1, "right")
        if (dir == "rtl") { var tmp = leftPos; leftPos = rightPos; rightPos = tmp }
        left = leftPos.left
        right = rightPos.right
      }
      if (fromArg == null && from == 0) { left = leftSide }
      if (rightPos.top - leftPos.top > 3) { // Different lines, draw top part
        add(left, leftPos.top, null, leftPos.bottom)
        left = leftSide
        if (leftPos.bottom < rightPos.top) { add(left, leftPos.bottom, null, rightPos.top) }
      }
      if (toArg == null && to == lineLen) { right = rightSide }
      if (!start || leftPos.top < start.top || leftPos.top == start.top && leftPos.left < start.left)
        { start = leftPos }
      if (!end || rightPos.bottom > end.bottom || rightPos.bottom == end.bottom && rightPos.right > end.right)
        { end = rightPos }
      if (left < leftSide + 1) { left = leftSide }
      add(left, rightPos.top, right - left, rightPos.bottom)
    })
    return {start: start, end: end}
  }

  var sFrom = range.from(), sTo = range.to()
  if (sFrom.line == sTo.line) {
    drawForLine(sFrom.line, sFrom.ch, sTo.ch)
  } else {
    var fromLine = getLine(doc, sFrom.line), toLine = getLine(doc, sTo.line)
    var singleVLine = visualLine(fromLine) == visualLine(toLine)
    var leftEnd = drawForLine(sFrom.line, sFrom.ch, singleVLine ? fromLine.text.length + 1 : null).end
    var rightStart = drawForLine(sTo.line, singleVLine ? 0 : null, sTo.ch).start
    if (singleVLine) {
      if (leftEnd.top < rightStart.top - 2) {
        add(leftEnd.right, leftEnd.top, null, leftEnd.bottom)
        add(leftSide, rightStart.top, rightStart.left, rightStart.bottom)
      } else {
        add(leftEnd.right, leftEnd.top, rightStart.left - leftEnd.right, leftEnd.bottom)
      }
    }
    if (leftEnd.bottom < rightStart.top)
      { add(leftSide, leftEnd.bottom, null, rightStart.top) }
  }

  output.appendChild(fragment)
}

// Cursor-blinking
function restartBlink(cm) {
  if (!cm.state.focused) { return }
  var display = cm.display
  clearInterval(display.blinker)
  var on = true
  display.cursorDiv.style.visibility = ""
  if (cm.options.cursorBlinkRate > 0)
    { display.blinker = setInterval(function () { return display.cursorDiv.style.visibility = (on = !on) ? "" : "hidden"; },
      cm.options.cursorBlinkRate) }
  else if (cm.options.cursorBlinkRate < 0)
    { display.cursorDiv.style.visibility = "hidden" }
}

function ensureFocus(cm) {
  if (!cm.state.focused) { cm.display.input.focus(); onFocus(cm) }
}

function delayBlurEvent(cm) {
  cm.state.delayingBlurEvent = true
  setTimeout(function () { if (cm.state.delayingBlurEvent) {
    cm.state.delayingBlurEvent = false
    onBlur(cm)
  } }, 100)
}

function onFocus(cm, e) {
  if (cm.state.delayingBlurEvent) { cm.state.delayingBlurEvent = false }

  if (cm.options.readOnly == "nocursor") { return }
  if (!cm.state.focused) {
    signal(cm, "focus", cm, e)
    cm.state.focused = true
    addClass(cm.display.wrapper, "CodeMirror-focused")
    // This test prevents this from firing when a context
    // menu is closed (since the input reset would kill the
    // select-all detection hack)
    if (!cm.curOp && cm.display.selForContextMenu != cm.doc.sel) {
      cm.display.input.reset()
      if (webkit) { setTimeout(function () { return cm.display.input.reset(true); }, 20) } // Issue #1730
    }
    cm.display.input.receivedFocus()
  }
  restartBlink(cm)
}
function onBlur(cm, e) {
  if (cm.state.delayingBlurEvent) { return }

  if (cm.state.focused) {
    signal(cm, "blur", cm, e)
    cm.state.focused = false
    rmClass(cm.display.wrapper, "CodeMirror-focused")
  }
  clearInterval(cm.display.blinker)
  setTimeout(function () { if (!cm.state.focused) { cm.display.shift = false } }, 150)
}

// Re-align line numbers and gutter marks to compensate for
// horizontal scrolling.
function alignHorizontally(cm) {
  var display = cm.display, view = display.view
  if (!display.alignWidgets && (!display.gutters.firstChild || !cm.options.fixedGutter)) { return }
  var comp = compensateForHScroll(display) - display.scroller.scrollLeft + cm.doc.scrollLeft
  var gutterW = display.gutters.offsetWidth, left = comp + "px"
  for (var i = 0; i < view.length; i++) { if (!view[i].hidden) {
    if (cm.options.fixedGutter) {
      if (view[i].gutter)
        { view[i].gutter.style.left = left }
      if (view[i].gutterBackground)
        { view[i].gutterBackground.style.left = left }
    }
    var align = view[i].alignable
    if (align) { for (var j = 0; j < align.length; j++)
      { align[j].style.left = left } }
  } }
  if (cm.options.fixedGutter)
    { display.gutters.style.left = (comp + gutterW) + "px" }
}
// 用于确保行号槽仍然适合当前文档大小。当需要更新时返回 true。
function maybeUpdateLineNumberWidth(cm) {
  if (!cm.options.lineNumbers) { return false }
  var doc = cm.doc, last = lineNumberFor(cm.options, doc.first + doc.size - 1), display = cm.display
  if (last.length != display.lineNumChars) {
    var test = display.measure.appendChild(elt("div", [elt("div", last)],
                                               "CodeMirror-linenumber CodeMirror-gutter-elt"))
    var innerW = test.firstChild.offsetWidth, padding = test.offsetWidth - innerW
    display.lineGutter.style.width = ""
    display.lineNumInnerWidth = Math.max(innerW, display.lineGutter.offsetWidth - padding) + 1
    display.lineNumWidth = display.lineNumInnerWidth + padding
    display.lineNumChars = display.lineNumInnerWidth ? last.length : -1
    display.lineGutter.style.width = display.lineNumWidth + "px"
    updateGutterSpace(cm)
    return true
  }
  return false
}

// 读取渲染行的实际高度，并更新其存储的高度以匹配。
function updateHeightsInViewport(cm) {
  var display = cm.display
  var prevBottom = display.lineDiv.offsetTop
  for (var i = 0; i < display.view.length; i++) {
    var cur = display.view[i], height = (void 0)
    if (cur.hidden) { continue }
    if (ie && ie_version < 8) {
      var bot = cur.node.offsetTop + cur.node.offsetHeight
      height = bot - prevBottom
      prevBottom = bot
    } else {
      var box = cur.node.getBoundingClientRect()
      height = box.bottom - box.top
    }
    var diff = cur.line.height - height
    if (height < 2) { height = textHeight(display) }
    if (diff > .001 || diff < -.001) {
      updateLineHeight(cur.line, height)
      updateWidgetHeight(cur.line)
      if (cur.rest) { for (var j = 0; j < cur.rest.length; j++)
        { updateWidgetHeight(cur.rest[j]) } }
    }
  }
}

// 读取并存储与给定行关联的行小部件的高度。
function updateWidgetHeight(line) {
  if (line.widgets) { for (var i = 0; i < line.widgets.length; ++i)
    { line.widgets[i].height = line.widgets[i].node.parentNode.offsetHeight } }
}

// 计算在给定视口中可见的行（默认为当前滚动位置）。视口可能包含顶部、
// 高度和确保（见 op.scrollToPos）属性。
function visibleLines(display, doc, viewport) {
  var top = viewport && viewport.top != null ? Math.max(0, viewport.top) : display.scroller.scrollTop
  top = Math.floor(top - paddingTop(display))
  var bottom = viewport && viewport.bottom != null ? viewport.bottom : top + display.wrapper.clientHeight

  var from = lineAtHeight(doc, top), to = lineAtHeight(doc, bottom)
  // 确保是一个 {from: {line, ch}, to: {line, ch}} 对象，并
  // 强制这些行进入视口（如果可能）。
  if (viewport && viewport.ensure) {
    var ensureFrom = viewport.ensure.from.line, ensureTo = viewport.ensure.to.line
    if (ensureFrom < from) {
      from = ensureFrom
      to = lineAtHeight(doc, heightAtLine(getLine(doc, ensureFrom)) + display.wrapper.clientHeight)
    } else if (Math.min(ensureTo, doc.lastLine()) >= to) {
      from = lineAtHeight(doc, heightAtLine(getLine(doc, ensureTo)) - display.wrapper.clientHeight)
      to = ensureTo
    }
  }
  return {from: from, to: Math.max(to, from + 1)}
}
// 同步可滚动区域和滚动条，确保视口覆盖可见区域。
function setScrollTop(cm, val) {
  if (Math.abs(cm.doc.scrollTop - val) < 2) { return }
  cm.doc.scrollTop = val
  if (!gecko) { updateDisplaySimple(cm, {top: val}) }
  if (cm.display.scroller.scrollTop != val) { cm.display.scroller.scrollTop = val }
  cm.display.scrollbars.setScrollTop(val)
  if (gecko) { updateDisplaySimple(cm) }
  startWorker(cm, 100)
}
// 同步滚动器和滚动条，确保槽口元素对齐。
function setScrollLeft(cm, val, isScroller) {
  if (isScroller ? val == cm.doc.scrollLeft : Math.abs(cm.doc.scrollLeft - val) < 2) { return }
  val = Math.min(val, cm.display.scroller.scrollWidth - cm.display.scroller.clientWidth)
  cm.doc.scrollLeft = val
  alignHorizontally(cm)
  if (cm.display.scroller.scrollLeft != val) { cm.display.scroller.scrollLeft = val }
  cm.display.scrollbars.setScrollLeft(val)
}

// 由于鼠标滚轮事件报告的增量值在浏览器之间甚至浏览器版本之间都不标准化，且通常非常不可预测，因此这段代码首先通过测量前几个鼠标滚轮事件的滚动效果来开始，然后从中检测出如何将增量转换为像素偏移量的方法。
//
// 我们想要知道滚轮事件将滚动的量的原因是，这为我们在实际滚动发生之前更新显示提供了机会，从而减少闪烁。

var wheelSamples = 0;
var wheelPixelsPerUnit = null;
// 在我们知道的浏览器上填充一个浏览器检测到的起始值。这些值不必准确——它们错误的结果只是第一次滚轮滚动时的轻微闪烁（如果它足够大）。
if (ie) { wheelPixelsPerUnit = -.53 }
else if (gecko) { wheelPixelsPerUnit = 15 }
else if (chrome) { wheelPixelsPerUnit = -.7 }
else if (safari) { wheelPixelsPerUnit = -1/3 }

function wheelEventDelta(e) {
  var dx = e.wheelDeltaX, dy = e.wheelDeltaY
  if (dx == null && e.detail && e.axis == e.HORIZONTAL_AXIS) { dx = e.detail }
  if (dy == null && e.detail && e.axis == e.VERTICAL_AXIS) { dy = e.detail }
  else if (dy == null) { dy = e.wheelDelta }
  return {x: dx, y: dy}
}
function wheelEventPixels(e) {
  var delta = wheelEventDelta(e)
  delta.x *= wheelPixelsPerUnit
  delta.y *= wheelPixelsPerUnit
  return delta
}

function onScrollWheel(cm, e) {
  var delta = wheelEventDelta(e), dx = delta.x, dy = delta.y

  var display = cm.display, scroll = display.scroller
  // 如果这里没有可滚动的内容，则退出
  var canScrollX = scroll.scrollWidth > scroll.clientWidth
  var canScrollY = scroll.scrollHeight > scroll.clientHeight
  if (!(dx && canScrollX || dy && canScrollY)) { return }

  // 在 OS X 上的 Webkit 浏览器中，当滚动事件的目标从可滚动元素中移除时，会中止动量滚动。
  // 这个 hack（参见 patchDisplay 中的相关代码）确保元素被保留。
  if (dy && mac && webkit) {
    outer: for (var cur = e.target, view = display.view; cur != scroll; cur = cur.parentNode) {
      for (var i = 0; i < view.length; i++) {
        if (view[i].node == cur) {
          cm.display.currentWheelTarget = cur
          break outer
        }
      }
    }
  }

  // On some browsers, horizontal scrolling will cause redraws to
  // happen before the gutter has been realigned, causing it to
  // wriggle around in a most unseemly way. When we have an
  // estimated pixels/delta value, we just handle horizontal
  // scrolling entirely here. It'll be slightly off from native, but
  // better than glitching out.
  if (dx && !gecko && !presto && wheelPixelsPerUnit != null) {
    if (dy && canScrollY)
      { setScrollTop(cm, Math.max(0, Math.min(scroll.scrollTop + dy * wheelPixelsPerUnit, scroll.scrollHeight - scroll.clientHeight))) }
    setScrollLeft(cm, Math.max(0, Math.min(scroll.scrollLeft + dx * wheelPixelsPerUnit, scroll.scrollWidth - scroll.clientWidth)))
    // Only prevent default scrolling if vertical scrolling is
    // actually possible. Otherwise, it causes vertical scroll
    // jitter on OSX trackpads when deltaX is small and deltaY
    // is large (issue #3579)
    if (!dy || (dy && canScrollY))
      { e_preventDefault(e) }
    display.wheelStartX = null // Abort measurement, if in progress
    return
  }

  // 'Project' the visible viewport to cover the area that is being
  // scrolled into view (if we know enough to estimate it).
  if (dy && wheelPixelsPerUnit != null) {
    var pixels = dy * wheelPixelsPerUnit
    var top = cm.doc.scrollTop, bot = top + display.wrapper.clientHeight
    if (pixels < 0) { top = Math.max(0, top + pixels - 50) }
    else { bot = Math.min(cm.doc.height, bot + pixels + 50) }
    updateDisplaySimple(cm, {top: top, bottom: bot})
  }

  if (wheelSamples < 20) {
    if (display.wheelStartX == null) {
      display.wheelStartX = scroll.scrollLeft; display.wheelStartY = scroll.scrollTop
      display.wheelDX = dx; display.wheelDY = dy
      setTimeout(function () {
        if (display.wheelStartX == null) { return }
        var movedX = scroll.scrollLeft - display.wheelStartX
        var movedY = scroll.scrollTop - display.wheelStartY
        var sample = (movedY && display.wheelDY && movedY / display.wheelDY) ||
          (movedX && display.wheelDX && movedX / display.wheelDX)
        display.wheelStartX = display.wheelStartY = null
        if (!sample) { return }
        wheelPixelsPerUnit = (wheelPixelsPerUnit * wheelSamples + sample) / (wheelSamples + 1)
        ++wheelSamples
      }, 200)
    } else {
      display.wheelDX += dx; display.wheelDY += dy
    }
  }
}

// SCROLLBARS

// Prepare DOM reads needed to update the scrollbars. Done in one
// shot to minimize update/measure roundtrips.
function measureForScrollbars(cm) {
  var d = cm.display, gutterW = d.gutters.offsetWidth
  var docH = Math.round(cm.doc.height + paddingVert(cm.display))
  return {
    clientHeight: d.scroller.clientHeight,
    viewHeight: d.wrapper.clientHeight,
    scrollWidth: d.scroller.scrollWidth, clientWidth: d.scroller.clientWidth,
    viewWidth: d.wrapper.clientWidth,
    barLeft: cm.options.fixedGutter ? gutterW : 0,
    docHeight: docH,
    scrollHeight: docH + scrollGap(cm) + d.barHeight,
    nativeBarWidth: d.nativeBarWidth,
    gutterWidth: gutterW
  }
}

var NativeScrollbars = function(place, scroll, cm) {
  this.cm = cm
  var vert = this.vert = elt("div", [elt("div", null, null, "min-width: 1px")], "CodeMirror-vscrollbar")
  var horiz = this.horiz = elt("div", [elt("div", null, null, "height: 100%; min-height: 1px")], "CodeMirror-hscrollbar")
  place(vert); place(horiz)

  on(vert, "scroll", function () {
    if (vert.clientHeight) { scroll(vert.scrollTop, "vertical") }
  })
  on(horiz, "scroll", function () {
    if (horiz.clientWidth) { scroll(horiz.scrollLeft, "horizontal") }
  })

  this.checkedZeroWidth = false
  // Need to set a minimum width to see the scrollbar on IE7 (but must not set it on IE8).
  if (ie && ie_version < 8) { this.horiz.style.minHeight = this.vert.style.minWidth = "18px" }
};

NativeScrollbars.prototype.update = function (measure) {
  var needsH = measure.scrollWidth > measure.clientWidth + 1
  var needsV = measure.scrollHeight > measure.clientHeight + 1
  var sWidth = measure.nativeBarWidth

  if (needsV) {
    this.vert.style.display = "block"
    this.vert.style.bottom = needsH ? sWidth + "px" : "0"
    var totalHeight = measure.viewHeight - (needsH ? sWidth : 0)
    // A bug in IE8 can cause this value to be negative, so guard it.
    this.vert.firstChild.style.height =
      Math.max(0, measure.scrollHeight - measure.clientHeight + totalHeight) + "px"
  } else {
    this.vert.style.display = ""
    this.vert.firstChild.style.height = "0"
  }

  if (needsH) {
    this.horiz.style.display = "block"
    this.horiz.style.right = needsV ? sWidth + "px" : "0"
    this.horiz.style.left = measure.barLeft + "px"
    var totalWidth = measure.viewWidth - measure.barLeft - (needsV ? sWidth : 0)
    this.horiz.firstChild.style.width =
      Math.max(0, measure.scrollWidth - measure.clientWidth + totalWidth) + "px"
  } else {
    this.horiz.style.display = ""
    this.horiz.firstChild.style.width = "0"
  }

  if (!this.checkedZeroWidth && measure.clientHeight > 0) {
    if (sWidth == 0) { this.zeroWidthHack() }
    this.checkedZeroWidth = true
  }

  return {right: needsV ? sWidth : 0, bottom: needsH ? sWidth : 0}
};

NativeScrollbars.prototype.setScrollLeft = function (pos) {
  if (this.horiz.scrollLeft != pos) { this.horiz.scrollLeft = pos }
  if (this.disableHoriz) { this.enableZeroWidthBar(this.horiz, this.disableHoriz, "horiz") }
};

NativeScrollbars.prototype.setScrollTop = function (pos) {
  if (this.vert.scrollTop != pos) { this.vert.scrollTop = pos }
  if (this.disableVert) { this.enableZeroWidthBar(this.vert, this.disableVert, "vert") }
};

NativeScrollbars.prototype.zeroWidthHack = function () {
  var w = mac && !mac_geMountainLion ? "12px" : "18px"
  this.horiz.style.height = this.vert.style.width = w
  this.horiz.style.pointerEvents = this.vert.style.pointerEvents = "none"
  this.disableHoriz = new Delayed
  this.disableVert = new Delayed
};

NativeScrollbars.prototype.enableZeroWidthBar = function (bar, delay, type) {
  bar.style.pointerEvents = "auto"
  function maybeDisable() {
    // To find out whether the scrollbar is still visible, we
    // check whether the element under the pixel in the bottom
    // right corner of the scrollbar box is the scrollbar box
    // itself (when the bar is still visible) or its filler child
    // (when the bar is hidden). If it is still visible, we keep
    // it enabled, if it's hidden, we disable pointer events.
    var box = bar.getBoundingClientRect()
    var elt = type == "vert" ? document.elementFromPoint(box.right - 1, (box.top + box.bottom) / 2)
        : document.elementFromPoint((box.right + box.left) / 2, box.bottom - 1)
    if (elt != bar) { bar.style.pointerEvents = "none" }
    else { delay.set(1000, maybeDisable) }
  }
  delay.set(1000, maybeDisable)
};

NativeScrollbars.prototype.clear = function () {
  var parent = this.horiz.parentNode
  parent.removeChild(this.horiz)
  parent.removeChild(this.vert)
};

var NullScrollbars = function () {};

NullScrollbars.prototype.update = function () { return {bottom: 0, right: 0} };
NullScrollbars.prototype.setScrollLeft = function () {};
NullScrollbars.prototype.setScrollTop = function () {};
NullScrollbars.prototype.clear = function () {};

function updateScrollbars(cm, measure) {
  if (!measure) { measure = measureForScrollbars(cm) }
  var startWidth = cm.display.barWidth, startHeight = cm.display.barHeight
  updateScrollbarsInner(cm, measure)
  for (var i = 0; i < 4 && startWidth != cm.display.barWidth || startHeight != cm.display.barHeight; i++) {
    if (startWidth != cm.display.barWidth && cm.options.lineWrapping)
      { updateHeightsInViewport(cm) }
    updateScrollbarsInner(cm, measureForScrollbars(cm))
    startWidth = cm.display.barWidth; startHeight = cm.display.barHeight
  }
}

// Re-synchronize the fake scrollbars with the actual size of the
// content.
function updateScrollbarsInner(cm, measure) {
  var d = cm.display
  var sizes = d.scrollbars.update(measure)

  d.sizer.style.paddingRight = (d.barWidth = sizes.right) + "px"
  d.sizer.style.paddingBottom = (d.barHeight = sizes.bottom) + "px"
  d.heightForcer.style.borderBottom = sizes.bottom + "px solid transparent"

  if (sizes.right && sizes.bottom) {
    d.scrollbarFiller.style.display = "block"
    d.scrollbarFiller.style.height = sizes.bottom + "px"
    d.scrollbarFiller.style.width = sizes.right + "px"
  } else { d.scrollbarFiller.style.display = "" }
  if (sizes.bottom && cm.options.coverGutterNextToScrollbar && cm.options.fixedGutter) {
    d.gutterFiller.style.display = "block"
    d.gutterFiller.style.height = sizes.bottom + "px"
    d.gutterFiller.style.width = measure.gutterWidth + "px"
  } else { d.gutterFiller.style.display = "" }
}

var scrollbarModel = {"native": NativeScrollbars, "null": NullScrollbars}

function initScrollbars(cm) {
  if (cm.display.scrollbars) {
    cm.display.scrollbars.clear()
    if (cm.display.scrollbars.addClass)
      { rmClass(cm.display.wrapper, cm.display.scrollbars.addClass) }
  }

  cm.display.scrollbars = new scrollbarModel[cm.options.scrollbarStyle](function (node) {
    cm.display.wrapper.insertBefore(node, cm.display.scrollbarFiller)
    // Prevent clicks in the scrollbars from killing focus
    on(node, "mousedown", function () {
      if (cm.state.focused) { setTimeout(function () { return cm.display.input.focus(); }, 0) }
    })
    node.setAttribute("cm-not-content", "true")
  }, function (pos, axis) {
    if (axis == "horizontal") { setScrollLeft(cm, pos) }
    else { setScrollTop(cm, pos) }
  }, cm)
  if (cm.display.scrollbars.addClass)
    { addClass(cm.display.wrapper, cm.display.scrollbars.addClass) }
}

// SCROLLING THINGS INTO VIEW

// If an editor sits on the top or bottom of the window, partially
// scrolled out of view, this ensures that the cursor is visible.
function maybeScrollWindow(cm, rect) {
  if (signalDOMEvent(cm, "scrollCursorIntoView")) { return }

  var display = cm.display, box = display.sizer.getBoundingClientRect(), doScroll = null
  if (rect.top + box.top < 0) { doScroll = true }
  else if (rect.bottom + box.top > (window.innerHeight || document.documentElement.clientHeight)) { doScroll = false }
  if (doScroll != null && !phantom) {
    var scrollNode = elt("div", "\u200b", null, ("position: absolute;\n                         top: " + (rect.top - display.viewOffset - paddingTop(cm.display)) + "px;\n                         height: " + (rect.bottom - rect.top + scrollGap(cm) + display.barHeight) + "px;\n                         left: " + (rect.left) + "px; width: " + (Math.max(2, rect.right - rect.left)) + "px;"))
    cm.display.lineSpace.appendChild(scrollNode)
    scrollNode.scrollIntoView(doScroll)
    cm.display.lineSpace.removeChild(scrollNode)
  }
}
// 将给定位置滚动到视图中（立即），并验证其实际可见（由于行高测量准确，
// 某些内容的位置在绘制过程中可能会“漂移”）。
function scrollPosIntoView(cm, pos, end, margin) {
  if (margin == null) { margin = 0 }
  var rect
  for (var limit = 0; limit < 5; limit++) {
    var changed = false
    var coords = cursorCoords(cm, pos)
    var endCoords = !end || end == pos ? coords : cursorCoords(cm, end)
    rect = {left: Math.min(coords.left, endCoords.left),
            top: Math.min(coords.top, endCoords.top) - margin,
            right: Math.max(coords.left, endCoords.left),
            bottom: Math.max(coords.bottom, endCoords.bottom) + margin}
    var scrollPos = calculateScrollPos(cm, rect)
    var startTop = cm.doc.scrollTop, startLeft = cm.doc.scrollLeft
    if (scrollPos.scrollTop != null) {
      setScrollTop(cm, scrollPos.scrollTop)
      if (Math.abs(cm.doc.scrollTop - startTop) > 1) { changed = true }
    }
    if (scrollPos.scrollLeft != null) {
      setScrollLeft(cm, scrollPos.scrollLeft)
      if (Math.abs(cm.doc.scrollLeft - startLeft) > 1) { changed = true }
    }
    if (!changed) { break }
  }
  return rect
}

// 将给定坐标集滚动到视图中（立即）。
function scrollIntoView(cm, rect) {
  var scrollPos = calculateScrollPos(cm, rect)
  if (scrollPos.scrollTop != null) { setScrollTop(cm, scrollPos.scrollTop) }
  if (scrollPos.scrollLeft != null) { setScrollLeft(cm, scrollPos.scrollLeft) }
}

// 计算将给定矩形滚动到视图中所需的新滚动位置。返回一个包含scrollTop和
// scrollLeft属性的对象。当这些属性未定义时，垂直/水平位置不需要调整。
function calculateScrollPos(cm, rect) {
  var display = cm.display, snapMargin = textHeight(cm.display)
  if (rect.top < 0) { rect.top = 0 }
  var screentop = cm.curOp && cm.curOp.scrollTop != null ? cm.curOp.scrollTop : display.scroller.scrollTop
  var screen = displayHeight(cm), result = {}
  if (rect.bottom - rect.top > screen) { rect.bottom = rect.top + screen }
  var docBottom = cm.doc.height + paddingVert(display)
  var atTop = rect.top < snapMargin, atBottom = rect.bottom > docBottom - snapMargin
  if (rect.top < screentop) {
    result.scrollTop = atTop ? 0 : rect.top
  } else if (rect.bottom > screentop + screen) {
    var newTop = Math.min(rect.top, (atBottom ? docBottom : rect.bottom) - screen)
    if (newTop != screentop) { result.scrollTop = newTop }
  }

  var screenleft = cm.curOp && cm.curOp.scrollLeft != null ? cm.curOp.scrollLeft : display.scroller.scrollLeft
  var screenw = displayWidth(cm) - (cm.options.fixedGutter ? display.gutters.offsetWidth : 0)
  var tooWide = rect.right - rect.left > screenw
  if (tooWide) { rect.right = rect.left + screenw }
  if (rect.left < 10)
    { result.scrollLeft = 0 }
  else if (rect.left < screenleft)
    { result.scrollLeft = Math.max(0, rect.left - (tooWide ? 0 : 10)) }
  else if (rect.right > screenw + screenleft - 3)
    { result.scrollLeft = rect.right + (tooWide ? 0 : 10) - screenw }
  return result
}

// 在当前操作中存储相对于滚动位置的调整（在操作完成时应用）。
function addToScrollPos(cm, left, top) {
  if (left != null || top != null) { resolveScrollToPos(cm) }
  if (left != null)
    { cm.curOp.scrollLeft = (cm.curOp.scrollLeft == null ? cm.doc.scrollLeft : cm.curOp.scrollLeft) + left }
  if (top != null)
    { cm.curOp.scrollTop = (cm.curOp.scrollTop == null ? cm.doc.scrollTop : cm.curOp.scrollTop) + top }
}
// 确保操作结束时当前光标可见。
function ensureCursorVisible(cm) {
  resolveScrollToPos(cm)
  var cur = cm.getCursor(), from = cur, to = cur
  if (!cm.options.lineWrapping) {
    from = cur.ch ? Pos(cur.line, cur.ch - 1) : cur
    to = Pos(cur.line, cur.ch + 1)
  }
  cm.curOp.scrollToPos = {from: from, to: to, margin: cm.options.cursorScrollMargin}
}

// 当操作的scrollToPos属性被设置，并且在操作结束前应用了另一个滚动动作时，
// 这会以一种廉价的方式“模拟”将该位置滚动到视图中，这样中间滚动命令的效果就不会被忽略。
function resolveScrollToPos(cm) {
  var range = cm.curOp.scrollToPos
  if (range) {
    cm.curOp.scrollToPos = null
    var from = estimateCoords(cm, range.from), to = estimateCoords(cm, range.to)
    var sPos = calculateScrollPos(cm, {
      left: Math.min(from.left, to.left),
      top: Math.min(from.top, to.top) - range.margin,
      right: Math.max(from.right, to.right),
      bottom: Math.max(from.bottom, to.bottom) + range.margin
    })
    cm.scrollTo(sPos.scrollLeft, sPos.scrollTop)
  }
}

// 操作用于包装一系列对编辑器状态的更改，
// 这样每个更改都不需要更新光标和显示（这将是笨拙的、缓慢的和容易出错的）。
// 相反，显示更新被批处理，然后一次性全部组合并执行。

var nextOpId = 0
// 开始一个新操作。
function startOperation(cm) {
  cm.curOp = {
    cm: cm,
    viewChanged: false,      // 指示行可能需要重绘的标志
    startHeight: cm.doc.height, // 用于检测是否需要更新滚动条
    forceUpdate: false,      // 用于强制重绘
    updateInput: null,       // 是否需要重置输入文本框
    typing: false,           // 此重置是否应小心保留现有文本（用于合成）
    changeObjs: null,        // 累积的更改，用于触发更改事件
    cursorActivityHandlers: null, // 用于在cursorActivity上触发的一组处理程序
    cursorActivityCalled: 0, // 跟踪哪些cursorActivity处理程序已经被调用
    selectionChanged: false, // 是否需要重绘选择
    updateMaxLine: false,    // 当需要重新确定最宽行时设置
    scrollLeft: null, scrollTop: null, // 中间滚动位置，尚未推送到DOM
    scrollToPos: null,       // 用于滚动到特定位置
    focus: false,
    id: ++nextOpId           // 唯一ID
  }
  pushOperation(cm.curOp)
}

// 完成一个操作，更新显示并触发延迟事件
function endOperation(cm) {
  var op = cm.curOp
  finishOperation(op, function (group) {
    for (var i = 0; i < group.ops.length; i++)
      { group.ops[i].cm.curOp = null }
    endOperations(group)
  })
}

// 操作完成时的DOM更新被批处理，
// 以便需要的最小重排次数。
function endOperations(group) {
  var ops = group.ops
  for (var i = 0; i < ops.length; i++) // 读取DOM
    { endOperation_R1(ops[i]) }
  for (var i$1 = 0; i$1 < ops.length; i$1++) // 写入DOM（可能）
    { endOperation_W1(ops[i$1]) }
  for (var i$2 = 0; i$2 < ops.length; i$2++) // 读取DOM
    { endOperation_R2(ops[i$2]) }
  for (var i$3 = 0; i$3 < ops.length; i$3++) // 写入DOM（可能）
    { endOperation_W2(ops[i$3]) }
  for (var i$4 = 0; i$4 < ops.length; i$4++) // 读取DOM
    { endOperation_finish(ops[i$4]) }
}

function endOperation_R1(op) {
  var cm = op.cm, display = cm.display
  maybeClipScrollbars(cm)
  if (op.updateMaxLine) { findMaxLine(cm) }

  op.mustUpdate = op.viewChanged || op.forceUpdate || op.scrollTop != null ||
    op.scrollToPos && (op.scrollToPos.from.line < display.viewFrom ||
                       op.scrollToPos.to.line >= display.viewTo) ||
    display.maxLineChanged && cm.options.lineWrapping
  op.update = op.mustUpdate &&
    new DisplayUpdate(cm, op.mustUpdate && {top: op.scrollTop, ensure: op.scrollToPos}, op.forceUpdate)
}

function endOperation_W1(op) {
  op.updatedDisplay = op.mustUpdate && updateDisplayIfNeeded(op.cm, op.update)
}
727d2eb8-8683-42bd