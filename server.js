/**
 * Created by Administrator on 2017/7/2.
 */

var http = require("http");
var Route = require("./router");
var fs = require("fs");
var path = require("path");

var mime = require("mime");
var ecstatic = require("ecstatic");

var fileServer = ecstatic({root: "./public"});
var router = new Route();
var formidable = require("formidable");
var SearchIndex = require("search-index");
var Readable = require("stream").Readable;
var s = new Readable({objectMode: true});
var qs = require("querystring");

// 创建 http 服务器
http.createServer(function (request, response) {
    if (!router.resolve(request, response)) {
        fileServer(request, response);
    }
}).listen(8000);

// 处理 response
var respond = function (response, status, data, type) {
    console.log("status code " + status);

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

// 将数据内容作为 JSON 传输到客户端
var respondAsJSON = function (response, status, data) {
    respond(response, status, JSON.stringify(data), "application/json");
};

// 根目录
var root_path = path.dirname(require.main.filename);

// 文件清单
function find_all() {
    // 找到在 contents 文件夹下所有文件
    var path_init = path.join(root_path, "contents");
    var results = [];

    function find_one(path_one) {
        var files = fs.readdirSync(path_one);
        for (var i = 0; i < files.length; i += 1) {
            // 检测是否是一个文件夹
            if (fs.lstatSync(path.join(path_one, files[i])).isDirectory()) {
                find_one(path.join(path_one, files[i]));
            } else {
                results.push({
                    name: files[i],
                    url: path.join(path_one, files[i])
                });
            }

            if (i === files.length) {
                return;
            }
        }
    }

    find_one(path_init);
    return results;
}

var results = find_all();

// 加入索引
var index;
var options = {};
SearchIndex(options, function (error, new_index) {
    if (!error) {
        index = new_index;
        // for (var i = 0; i < results.length; i += 1) {
        //     s.push(results[i]);
        // }
        // s.push(null);
        // s.pipe(index.defaultPipeline())
        //     .pipe(index.add())
        //     .on("finish", function () {
        //         console.log("Adding index finished");
        //     });
        // 搜索测试
        // var key = "vincent";
        // var q = {};
        // q.query = {
        //     AND: {"*": [key]}
        // };
        // index.search(q)
        //     .on("data", function (doc) {
        //         console.log(doc);
        //     });
    }
});



// 得到文件存储大小
var getFileSize = function (filepath) {
    var stats = fs.statSync(filepath);
    var size = stats["size"];

    // 转换为 Mb 输出
    return size / 1e6;
};

// 得到当前时间
var getDate = function () {
    var date = new Date();

    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var minute = date.getMinutes();
    var second = date.getSeconds();

    return [year, month, day, hour, minute, second];
};

// 得到文件夹中的文件信息
// fs.readdir 是否可以是相对路径，需要测试一下
// 这里输入的是相对路径
var getDirectoryFiles = function (directory_path, callback) {
    // 文件夹的绝对路径
    var directory_path_abs = path.join(root_path, directory_path);

    // 读取指定文件夹中的文件信息
    fs.readdir(directory_path_abs, function (error, files) {
        if (error) {
            callback(error);
        } else {
            var file_list = [];
            file_list.push({directory: directory_path});
            for (var i = 0; i < files.length; i += 1) {
                var filename = files[i];
                var filepath = path.join(directory_path_abs, filename);
                var filesize = getFileSize(filepath);
                var filemime = mime.lookup(filepath);

                // 填入文件信息
                file_list.push({
                    filename: filename,
                    filepath: directory_path,
                    filesize: filesize,
                    filemime: filemime,
                    filedate: getDate()
                });
            }

            callback(null, file_list);
        }
    });
};


router.add("GET", /^\/contents(\/[\w\d]+)*$/, function (request, response, command) {
    // 匹配 /contents/some1/some2...
    // 获取一个子文件夹中的所有文件

    // 获取路径
    var directory_path = require("url").parse(request.url).pathname;

    // 读取文件夹中内容
    getDirectoryFiles(directory_path, function (error, file_list) {
        // 处理错误
        if (error) {
            respond(response, 500, error.toString());
        } else {
            // 停 3 秒发送到客户端
            setTimeout(function () {
                respondAsJSON(response, 200, file_list);
            }, 3000);
        }
    });
});


router.add("POST", /^\/upload(\/[\w\d]+)+$/, function (request, response, command) {
    // 上传文件夹
    var pathname = require("url").parse(request.url).pathname;
    var dirname = "";
    var match = pathname.match(/[\w\d]+/g);
    for (var i = 1; i < match.length; i += 1) {
        dirname += "/";
        dirname += match[i];
    }

    // 处理上传
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
    form.parse(request);
});

router.add("POST", /^\/search$/, function (request, response, command) {
    // 解析 query string
    var body = "";
    request.on("data", function (data) {
        body += data;
        
        if (body.length > 1e6) {
            request.connection.destroy();
        }
    });
    
    request.on("end", function () {
        var params = qs.parse(body);
        var search_results = [];
        console.log(params);
        var q = {};
        q.query = {
            AND: {"*": [params.key]}
        };
        index.search(q)
            .on("data", function (doc) {
                search_results.push(doc.document);
            })
            .on("end", function () {
                console.log(search_results);
                respondAsJSON(response, 200, search_results);
            })
    });
});












