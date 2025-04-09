/* 版权所有 2012 Go 作者。保留所有权利。
 * 本源代码的使用受 BSD 风格许可证的约束，
 * 许可证可以在 LICENSE 文件中找到。
 */
'use strict';

/* 指令 */

angular.module('tour.directives', []).

// onpageup 在释放 Page Up 键时执行给定的表达式。
directive('onpageup', function() {
    return function(scope, elm, attrs) {
        elm.attr('tabindex', 0);
        elm.keyup(function(evt) {
            var key = evt.which || evt.keyCode;
            if (key == 33 && !evt.ctrlKey) {
                scope.$apply(attrs.onpageup);
                evt.preventDefault();
            }
        });
    };
}).

// onpagedown 在释放 Page Down 键时执行给定的表达式。
directive('onpagedown', function() {
    return function(scope, elm, attrs) {
        elm.attr('tabindex', 0);
        elm.keyup(function(evt) {
            var key = evt.which || evt.keyCode;
            if (key == 34 && !evt.ctrlKey) {
                scope.$apply(attrs.onpagedown);
                evt.preventDefault();
            }
        });
    };
}).

// autofocus 在条件为真时将焦点设置到给定的元素上。
directive('autofocus', function() {
    return function(scope, elm, attrs) {
        elm.attr('tabindex', 0);
        scope.$watch(function() {
            return scope.$eval(attrs.autofocus);
        }, function(val) {
            if (val === true) $(elm).focus();
        });
    };
}).

// imports-checkbox 激活和停用
directive('importsCheckbox', ['editor',
    function(editor) {
        return function(scope, elm) {
            elm.click(function() {
                editor.toggleImports();
                scope.$digest();
            });
            scope.editor = editor;
        };
    }
]).

// syntax-checkbox 激活和停用
directive('syntaxCheckbox', ['editor',
    function(editor) {
        return function(scope, elm) {
            elm.click(function() {
                editor.toggleSyntax();
                scope.$digest();
            });
            scope.editor = editor;
        };
    }
]).

// vertical-slide 在左侧和右侧元素之间创建一个滑动分隔符。
// 例如：
// <div id="header">一些内容</div>
// <div vertical-slide top="#header" bottom="#footer"></div>
// <div id="footer">一些页脚</div>
directive('vertical-slide', ['editor',
    function(editor) {
        return function(scope, elm, attrs) {
            var moveTo = function(x) {
                if (x < 0) {
                    x = 0;
                }
                if (x > $(window).width()) {
                    x = $(window).width();
                }
                elm.css('left', x);
                $(attrs.left).width(x);
                $(attrs.right).offset({
                    left: x
                });
                editor.x = x;
            };

            elm.draggable({
                axis: 'x',
                drag: function(event) {
                    moveTo(event.clientX);
                    return true;
                },
                containment: 'parent',
            });

            if (editor.x !== undefined) {
                moveTo(editor.x);
            }
        };
    }
]).

// horizontal-slide 在顶部和底部元素之间创建一个滑动分隔符。
// <div id="menu">一些菜单</div>
// <div vertical-slide left="#menu" bottom="#content"></div>
// <div id="content">一些内容</div>
directive('horizontal-slide', ['editor',
    function(editor) {
        return function(scope, elm, attrs) {
            var moveTo = function(y) {
                var top = $(attrs.top).offset().top;
                if (y < top) {
                    y = top;
                }
                elm.css('top', y - top);
                $(attrs.top).height(y - top);
                $(attrs.bottom).offset({
                    top: y,
                    height: 0
                });
                editor.y = y;
            };
            elm.draggable({
                axis: 'y',
                drag: function(event) {
                    moveTo(event.clientY);
                    return true;
                },
                containment: 'parent',
            });

            if (editor.y !== undefined) {
                moveTo(editor.y);
            }
        };
    }
]).
directive('tableOfContentsButton', ['i18n', function(i18n) {
    var speed = 250;
    return {
        restrict: 'A',
        templateUrl: '/tour/static/partials/toc-button.html',
        link: function(scope, elm, attrs) {
            scope.tocMessage = i18n.l('toc');
            elm.on('click', function() {
                var toc = $(attrs.tableOfContentsButton);
                // 在显示目录之前隐藏所有非活动课程。
                var visible = toc.css('display') != 'none';
                if (!visible) {
                    toc.find('.toc-lesson:not(.active) .toc-page').hide();
                    toc.find('.toc-lesson.active .toc-page').show();
                }
                toc.toggle('slide', {
                    direction: 'right'
                }, speed);

                // 如果是全屏模式，在显示目录时隐藏其余内容。
                var fullScreen = toc.width() == $(window).width();
                if (fullScreen) $('#editor-container')[visible ? 'show' : 'hide']();
            });
        }
    };
}]).

// 带有动态目录的侧边栏
directive('tableOfContents', ['$routeParams', 'toc',
    function($routeParams, toc) {
        var speed = 250;
        return {
            restrict: 'A',
            templateUrl: '/tour/static/partials/toc.html',
            link: function(scope, elm) {
                scope.toc = toc;
                scope.params = $routeParams;

                scope.toggleLesson = function(id) {
                    var l = $('#toc-l-' + id + ' .toc-page');
                    l[l.css('display') == 'none' ? 'slideDown' : 'slideUp']();
                };

                scope.$watch(function() {
                    return scope.params.lessonId + scope.params.lessonId;
                }, function() {
                    $('.toc-lesson:not(#toc-l-' + scope.params.lessonId + ') .toc-page').slideUp(speed);
                });

                scope.hideTOC = function(fullScreenOnly) {
                    var fullScreen = elm.find('.toc').width() == $(window).width();
                    if (fullScreenOnly && !fullScreen) {
                        return;
                    }
                    $('.toc').toggle('slide', {
                        direction: 'right'
                    }, speed);
                    $('#editor-container').show();
                };
            }
        };
    }
]).

directive('feedbackButton', ['i18n', function(i18n) {
    return {
        restrict: 'A',
        templateUrl: '/tour/static/partials/feedback-button.html',
        link: function(scope, elm, attrs) {
            scope.feedbackMessage = i18n.l('submit-feedback');

            elm.on('click', function() {
                var context = window.location.pathname === '/tour/list'
                    ? '/tour/list'
                    : '/tour/' + scope.params.lessonId + '/' + scope.params.pageNumber;
	        context = window.location.protocol + '//' + window.location.host + context;
                var title = i18n.l('issue-title');
                var body = i18n.l('context') + ': '+ context + '\n\n'+ i18n.l('issue-message');
                var url = 'https://' + i18n.l('github-repo') + '/issues/new'
                    + '?title=' + encodeURIComponent(title)
                    + '&body=' + encodeURIComponent(body);
                window.open(url);
            });
        }
    };
}]);