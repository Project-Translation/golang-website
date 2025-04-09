# Go网站

[![Go参考](https://pkg.go.dev/badge/golang.org/x/website.svg)](https://pkg.go.dev/golang.org/x/website)

此存储库包含go.dev和golang.org网站的内容和服务程序。

内容位于_content/（go.dev）和tour/（go.dev/tour）。
服务器代码位于cmd/和internal/。

要运行组合的go.dev+golang.org服务器以预览本地内容更改，请使用：

    go run ./cmd/golangorg

支持程序cmd/admingolangorg和cmd/googlegolangorg
是admin.golang.org和google.golang.org的服务器。
（它们不使用_content/目录。）

每个命令目录都有自己的README.md，解释部署。

## JS/TS/CSS格式化

此存储库使用[eslint](https://eslint.org/)来格式化JS和TS文件，
并使用[stylelint](https://stylelint.io/)来格式化CSS文件。

另见：

- [CSS](https://go.dev/wiki/CSSStyleGuide)
- [JavaScript](https://google.github.io/styleguide/jsguide.html)
- [TypeScript](https://google.github.io/styleguide/tsguide.html)

鼓励在提交更改之前运行所有JS、TS和CSS代码通过格式化程序。
但是，这不是由CI强制执行的严格要求。

### 安装npm依赖：

1. 安装[docker](https://docs.docker.com/get-docker/)
2. 在存储库根目录创建一个.gitignore文件
3. 将.gitignore和node_modules添加到.gitignore
4. 运行`./npm install`

### 运行ESlint

    ./npx eslint [选项] [文件] [目录]

### 运行Stylelint

    ./npx stylelint [输入] [选项]

## TypeScript支持

从_content提供的TypeScript文件被转换为JavaScript。
在html模板中引用.ts文件作为模块代码。

  `<script type="module" src="/ts/filename.ts">`

使用[jest](https://jestjs.io/)测试框架为TypeScript代码编写单元测试。

### 运行Jest

    ./npx jest [测试路径模式]

## 部署

每次审查并提交CL时，代码都会部署到App Engine。
有关详细信息，请参见[cmd/golangorg/README.md](cmd/golangorg/README.md#deploying-to-go_dev-and-golang_org)。

## 报告问题/发送补丁

此存储库使用Gerrit进行代码更改。要了解如何向此存储库提交更改，请参见https://go.dev/doc/contribute。

git存储库位于https://go.googlesource.com/website。

网站存储库的主要问题跟踪器位于
https://go.dev/issues。在主题行中使用“x/website:”前缀，以便于查找。