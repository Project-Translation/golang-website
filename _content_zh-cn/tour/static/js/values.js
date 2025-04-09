/* 版权所有 2012 Go 作者。保留所有权利。
 * 本源代码的使用受 BSD 风格许可证的约束，
 * 许可证可以在 LICENSE 文件中找到。
 */
'use strict';

angular.module('tour.values', []).

// 包含描述和课程的模块列表。
value('tableOfContents', [{
    'id': 'mechanics',
    'title': '使用教程',
    'description': '<p>欢迎体验 <a href="https://go.dev">Go 编程语言</a> 的教程。教程涵盖了语言中最重要的功能，主要包括：</p>',
    'lessons': ['welcome']
}, {
    'id': 'basics',
    'title': '基础',
    'description': '<p>起点，学习语言的所有基础知识。</p><p>声明变量，调用函数，以及在进入下一课程之前需要了解的所有内容。</p>',
    'lessons': ['basics', 'flowcontrol', 'moretypes']
}, {
    'id': 'methods',
    'title': '方法和接口',
    'description': '<p>学习如何在类型上定义方法，如何声明接口，以及如何将一切整合在一起。</p>',
    'lessons': ['methods']
}, {
    'id': 'generics',
    'title': '泛型',
    'description': '<p>学习如何在 Go 函数和结构体中使用类型参数。</p>',
    'lessons': ['generics']
}, {
    'id': 'concurrency',
    'title': '并发',
    'description': '<p>Go 提供了并发功能作为核心语言的一部分。</p><p>本模块介绍了 goroutines 和通道，以及它们如何用于实现不同的并发模式。</p>',
    'lessons': ['concurrency']
}]).

// 翻译
value('translation', {
    'off': '关闭',
    'on': '开启',
    'syntax': '语法高亮',
    'lineno': '行号',
    'reset': '重置幻灯片',
    'format': '格式化源代码',
    'kill': '终止程序',
    'run': '运行',
    'compile': '编译并运行',
    'more': '选项',
    'toc': '目录',
    'prev': '上一页',
    'next': '下一页',
    'waiting': '等待远程服务器...',
    'errcomm': '与远程服务器通信错误。',
    'submit-feedback': '发送关于此页面的反馈',

    // GitHub 问题模板：翻译时更新仓库和消息。
    'github-repo': 'github.com/golang/tour',
    'issue-title': 'tour: [用简短描述替换]',
    'issue-message': '更改上面的标题以描述您的问题，并在此处添加您的反馈，包括必要的代码',
    'context': '上下文',
}).

// codemirror 插件配置
value('ui.config', {
    codemirror: {
        mode: 'text/x-go',
        matchBrackets: true,
        lineNumbers: true,
        autofocus: true,
        indentWithTabs: true,
        indentUnit: 4,
        tabSize: 4,
        lineWrapping: true,
        extraKeys: {
            'Shift-Enter': function() {
                $('#run').click();
            },
            'Ctrl-Enter': function() {
                $('#format').click();
            },
            'PageDown': function() {
                return false;
            },
            'PageUp': function() {
                return false;
            },
        },
        // TODO: 是否有更好的方法来做这个？
        // AngularJS 值不能依赖于工厂。
        onChange: function() {
            if (window.codeChanged !== null) window.codeChanged();
        }
    }
}).
// 从旧路径 (#42) 到新组织的映射。
// 这些值是使用工具目录中的 map.sh 脚本生成的。
value('mapping', {
    '#1': '/welcome/1', // 你好，世界
    '#2': '/welcome/2', // 本地化
    '#3': '/basics/1', // 包
    '#4': '/basics/2', // 导入
    '#5': '/basics/3', // 导出名称
    '#6': '/basics/4', // 函数
    '#7': '/basics/5', // 函数继续
    '#8': '/basics/6', // 多返回值
    '#9': undefined, // 命名返回值
    '#10': '/basics/8', // 变量
    '#11': '/basics/9', // 带初始值的变量
    '#12': '/basics/10', // 短变量声明
    '#13': '/basics/11', // 基本类型
    '#14': '/basics/13', // 类型转换
    '#15': '/basics/15', // 常量
    '#16': '/basics/16', // 数值常量
    '#17': '/flowcontrol/1', // For
    '#18': '/flowcontrol/2', // For 继续
    '#19': '/flowcontrol/3', // For 是 Go 的 "while"
    '#20': '/flowcontrol/4', // 永久循环
    '#21': '/flowcontrol/5', // If
    '#22': '/flowcontrol/6', // 带短语句的 If
    '#23': '/flowcontrol/7', // If 和 else
    '#24': '/flowcontrol/8', // 练习：循环和函数
    '#25': '/moretypes/2', // 结构体
    '#26': '/moretypes/3', // 结构体字段
    '#27': '/moretypes/1', // 指针
    '#28': '/moretypes/5', // 结构体字面量
    '#29': undefined, // new 函数
    '#30': '/moretypes/6', // 数组
    '#31': '/moretypes/7', // 切片
    '#32': '/moretypes/8', // 切片切片
    '#33': '/moretypes/9', // 创建切片
    '#34': '/moretypes/10', // 空切片
    '#35': '/moretypes/12', // 范围
    '#36': '/moretypes/13', // 范围继续
    '#37': '/moretypes/14', // 练习：切片
    '#38': '/moretypes/15', // 映射
    '#39': '/moretypes/16', // 映射字面量
    '#40': '/moretypes/17', // 映射字面量继续
    '#41': '/moretypes/18', // 修改映射
    '#42': '/moretypes/19', // 练习：映射
    '#43': '/moretypes/20', // 函数值
    '#44': '/moretypes/21', // 函数闭包
    '#45': '/moretypes/22', // 练习：Fibonacci 闭包
    '#46': '/flowcontrol/9', // Switch
    '#47': '/flowcontrol/10', // Switch 评估顺序
    '#48': '/flowcontrol/11', // 无条件的 Switch
    '#49': undefined, // 高级练习：复杂立方根
    '#50': undefined, // 方法和接口
    '#51': '/methods/1', // 方法
    '#52': '/methods/2', // 方法继续
    '#53': '/methods/3', // 指针接收器的方法
    '#54': '/methods/4', // 接口
    '#55': '/methods/5', // 接口隐式满足
    '#56': '/methods/8', // 错误
    '#57': '/methods/9', // 练习：错误
    '#58': '/methods/13', // Web 服务器
    '#59': '/methods/14', // 练习：HTTP 处理器
    '#60': '/methods/15', // 图像
    '#61': '/methods/16', // 练习：图像
    '#62': undefined, // 练习：Rot13 读取器
    '#63': undefined, // 并发
    '#64': '/concurrency/1', // 协程
    '#65': '/concurrency/2', // 通道
    '#66': '/concurrency/3', // 带缓冲的通道
    '#67': '/concurrency/4', // 范围和关闭
    '#68': '/concurrency/5', // Select
    '#69': '/concurrency/6', // 默认选择
    '#70': '/concurrency/7', // 练习：等价二叉树
    '#71': '/concurrency/8', // 练习：等价二叉树
    '#72': '/concurrency/9', // 练习：Web 爬虫
    '#73': '/concurrency/10', // 从这里开始...
});