# cloud-disk
项目的愿景
* 类似百度云盘，可以在网络上存储文件。
* 实现文件的上传，文件夹的建立，文件的搜索，文件的在线显示，分类搜索等等功能。
* 还有一个大胆的想法是可以实现在线压缩并发送邮件，以附件的形式发送云盘中的文件。

目前实现的内容
* 文件的上传和存储
* 部分实现文件的搜索

学到的东西
* 在客户端，发送 ajax 请求，利用`FormData`打包上传文件
* 在服务器端，处理 ajax 请求，利用 formidable 模块处理文件上传，利用 search-index 实现搜索
* 对于 POST，如何在客户端发送参数，在服务器端又如何解析这些参数
* 一定程度上理解了路由在服务器中的作用

to do list
* 逐步实现项目愿景

文档中会详细说明的内容
* 如何在客户端实现 ajax
* 如何在服务器端解析 ajax
* formidable 模块的使用
* search-index 模块的使用

# 学到的内容
## 客户端实现 ajax
关键词
* 异步
* 异常
* 封装

### 异步
`XMLHttpRequest`有两种实现 ajax 的方式，同步和异步。
```js
// 同步方式
var request = new XMLHttpRequest();
request.open('GET', '/bar/foo.txt', false);  // `false` makes the request synchronous
request.send(null);

if (request.status === 200) {
  console.log(request.responseText);
}

// 异步方式
var xhr = new XMLHttpRequest();
xhr.open("GET", "/bar/foo.txt", true);
xhr.onload = function (e) {
  if (xhr.readyState === 4) {
    if (xhr.status === 200) {
      console.log(xhr.responseText);
    } else {
      console.error(xhr.statusText);
    }
  }
};
xhr.onerror = function (e) {
  console.error(xhr.statusText);
};
xhr.send(null);
```
同步的方式需要去等待，等服务器端处理完了给客户端返回消息时才能继续下面的操作。
但是异步的方式有些不同，可以边等待服务器端的消息边处理别的事情。
一般使用都是用异步的方式。

### 异常
在处理 ajax 时会发生一些错误（异常）。
```js
var req = new XMLHttpRequest();
req.open(options.method || "GET", options.pathname, true);

req.addEventListener("load", function () {
    // 2XX 为成功，3XX 为重定向，4XX 为客户端错误，5XX 为服务器错误
    if (req.status < 400) {
        stopMessage();
        callback(null, req.responseText);
    } else {
        callback(new Error("Request failed: ", req.statusText));
    }
});
req.addEventListener("error", function () {
    callback(new Error("Network error"));
});

req.send(options.body || null);
```
上面的代码说明了两种异常。一种是服务器端处理出了问题，
`status`会大于 400，也可以从`status`的具体数字推断到底出了什么问题。
另一种是和服务器连接出现了问题。

这些问题如果得不到妥善处理就会影响到程序的正常运行。

### 封装
因为不仅仅需要在一个地方使用 ajax，所以需要想办法把 ajax 请求的一般过程
封装成函数。因为 ajax 是异步过程，封装函数时需要特别对待。
```js
var request = function (options, callback) {

    // 处理 ajax 页面请求
    var req = new XMLHttpRequest();
    req.open(options.method || "GET", options.pathname, true);
    // load 事件在传输结束时会触发，progress 事件监控传输进度
    req.addEventListener("load", function () {
        // 2XX 为成功，3XX 为重定向，4XX 为客户端错误，5XX 为服务器错误
        if (req.status < 400) {
            stopMessage();
            callback(null, req.responseText);
        } else {
            callback(new Error("Request failed: ", req.statusText));
        }
    });
    req.addEventListener("error", function () {
        callback(new Error("Network error"));
    });
    
    // 可以将 post 的 params 放进 body 中传递到服务器端
    req.send(options.body || null);
};
```
`callback`是回调函数，在连接成功或者失败时调用。
对于不同的情况，定制`callback`的代码。
这个函数可以处理大部分的情况，
包括利用`post`向服务器端传递`params`以及`FormData`数据。

## 服务器端解析 ajax
关键词
* 路由
* 请求
* 反馈

### 路由
路由就是根据请求路径的不同，将任务分配给不同的程序模块完成。
路由是非常重要的，在后端编程过程中应该要根据请求方法和路径的不同来分派
不同的程序模块完成。

### 请求
在后端`request`是前端请求的汇总，可以通过`request`变量解析前端请求。
以后如果遇到需要可以去查[官方文档](https://nodejs.org/api/http.html#http_class_http_incomingmessage)。
```js
// 获取文件路径
$ node
> require('url').parse('/status?name=ryan')
Url {
  protocol: null,
  slashes: null,
  auth: null,
  host: null,
  port: null,
  hostname: null,
  hash: null,
  search: '?name=ryan',
  query: 'name=ryan',
  pathname: '/status',
  path: '/status?name=ryan',
  href: '/status?name=ryan' }

// 从文件路径中获取 query string
$ node
> require('url').parse('/status?name=ryan', true)
Url {
  protocol: null,
  slashes: null,
  auth: null,
  host: null,
  port: null,
  hostname: null,
  hash: null,
  search: '?name=ryan',
  query: { name: 'ryan' },
  pathname: '/status',
  path: '/status?name=ryan',
  href: '/status?name=ryan' }
```
### 反馈
后端处理完毕后需要给前端反馈结果，利用`response`把结果返回给客户端。
因为需要多处使用，需要进行封装。
```js
var respond = function (response, status, data, type) {
    response.writeHead(status, {
        "Content-Type": type || "text/plain"
    });

    // 检测是否为文件
    // 若为文件则必为 stream data
    if (data && data.pipe) {
        data.pipe(response);
    } else {
        response.end(data);
    }
};
```
给前端返回`response`时，注意需要设置`headers`。
同时如果需要给前端返回数据，可以利用`json`数据格式。

## formidable 模块
若从客户端上传文件时，可以通过`FormData`模块实现。
将文件封装到`FormData`中，利用 ajax 传递到后端即可。
而 formidable 模块就是专门用于解析上传文件。
formidable 模块的用法如下。
```js
var form = new formidable.IncomingForm();
form.multiples = true;
form.uploadDir = path.join(root_path, dirname);
form.on("file", function (field, file) {
    fs.rename(file.path, path.join(form.uploadDir, file.name));
});
form.on("error", function (error) {
    respond(response, 500);
});
form.on("end", function () {
    respond(response, 204);
});
form.parse(request); // 这里是最关键的，解析 request 得到其中的上传文件
```
代码中最关键的是最后一行，漏了最后一行就没法接收上传文件了。

## search-index 模块
可以利用 search-index 模块实现搜索功能。
创建搜索需要首先建立索引，需要注意的是只要索引加入一次就会记住。
```js
var index;
var options = {};
var search_results = [];
SearchIndex(options, function (error, new_index) {
    if (!error) {
        index = new_index;
        for (var i = 0; i < results.length; i += 1) {
            s.push(results[i]);
        }
        s.push(null);
        s.pipe(index.defaultPipeline())
            .pipe(index.add())
            .on("finish", function () {
                console.log("Adding index finished");
            });
        
        // 搜索
        var key = "vincent";
        var q = {};
        q.query = {
            AND: {"*": [key]}
        };
        index.search(q)
            .on("data", function (doc) {
                search_results.push(doc.document);
            })
            .on("end", function () {
                console.log(search_results);
                respondAsJSON(response, 200, search_results);
            })
    }
});
```
建立索引可以从文件中读取，也可以是实际的 js 变量。
不过最后都需要编程 readable stream 的形式。
最后需要注意的是，搜索是异步的过程，而且是一个一个搜索。
当所有条目搜索完毕之后会发出一个`end`事件，可以在此时把结果汇总。














