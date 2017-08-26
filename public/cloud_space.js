"use strict";

// 创建 DOM 元素
// dom_name, string，元素名称
// attrs, object, 元素的属性
var createElement = function (dom_name, attrs) {
    var element = document.createElement(dom_name);

    // 设置元素属性
    if (attrs) {
        for (var attr in attrs) {
            element.setAttribute(attr, attrs[attr]);
        }
    }

    return element;
};

// 弹出框中显示信息
var showMessage = function (message) {
    // 弹出框按钮
    var modal_message_btn = document.getElementById("modal-message-btn");

    // 消息体
    var modal_message_body = document.getElementById("modal-message-body");

    // 删除原来的内容 & 修改弹出框的消息内容
    if (document.querySelector("p")) {
        modal_message_body.removeChild(document.querySelector("p"));
    }
    var p = createElement("p");
    p.textContent = message;
    modal_message_body.appendChild(p);

    // 触发弹出框按钮
    modal_message_btn.click();
};

// 关闭弹出框消息
var stopMessage = function () {
    var modal_message_close = document.getElementById("modal-message-close");
    modal_message_close.click();
};

// 包裹 ajax 请求
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
    // 如果想要上传文件，这里估计不行
    req.send(options.body || null);
};

// 第一次页面加载显示文件列表
showMessage("正在处理...");
request({pathname: "contents"}, function (error, response) {
    // 处理错误
    if (error) {
        // 去掉加载刷新的标志，显示错误信息，加入刷新按钮
        reportError(error);
    } else {
        // response 是一个 JSON 形式的字符串，解析后为一个数组
        // 数组中元素为对象，对象中键包含：filename, storagepath, filesize, lasttimesincechange
        // filename: 字符串，表示文件名称
        // storagepath: 字符串，表示相对文件路径
        // filesize: 数字，表示文件存储空间大小，单位为 Mb
        // lasttimesincechange: 数组，表示日期，[year, month, day, hour, minute, second]
        response = JSON.parse(response);
        updateTableData(response);
    }
});

// 处理日期
var handleDate = function (date) {
    return String(date[0]) + "年" + String(date[1]) + "月" + String(date[2]) + "日" + String(date[3]) + "点" + String(date[4]) + "分";
};

// 处理面包屑导航栏
var updateBreadcrumb = function (directory) {
    // 获取子文件夹
    var path_list = directory.match(/([a-zA-Z0-9]+)/g);

    // 获取 DOM 元素
    var breadcrumb = document.querySelector(".breadcrumb");

    // 删除之前的元素
    var breadcrumb_list = document.querySelectorAll(".breadcrumb li");
    for (var i = 0; i < breadcrumb_list.length; i += 1) {
        breadcrumb.removeChild(breadcrumb_list[i]);
    }

    // 建立子文件夹
    for (i = 0; i < path_list.length; i += 1) {
        var li = createElement("li", {"data-type": "application/octet-stream", "data-dirname": path_list[i]});

        if (i === path_list.length - 1) {
            // 若为当前文件夹，则删去链接
            li.textContent = path_list[i];
        } else {
            // 若不是当前文件夹，则添加链接
            var link = createElement("a", {
                href: path_list.slice(0, i + 1).join("/")
            });
            link.textContent = path_list[i];
            link.addEventListener("click", getResource);
            li.appendChild(link);
        }

        breadcrumb.appendChild(li);
    }
};

// 获取资源
// 点击时触发该事件
var getResource = function (event) {
    // 阻止默认行为发送
    event.preventDefault();

    // 获取点击 dom
    var target = event.target;

    // 获取请求路径
    var filepath = target.getAttribute("href");

    // 获取类型
    var filemime = target.getAttribute("file-type");

    // 处理文件夹
    if (filemime.match(/application/)) {
        request({pathname: filepath}, function (error, response) {
            // 处理错误
            if (error) {
                // 去掉加载刷新的标志，显示错误信息，加入刷新按钮
                reportError(error);
            } else {
                // response 为 JSON 形式的字符串，首先解析为 js 值
                response = JSON.parse(response);

                // 根据当前文件夹更新列表
                updateTableData(response);
            }
        });
    }
};

// 处理文件列表的显示
// response 是一个 JSON 形式的字符串，解析后为一个数组
// 数组中元素为对象，对象中键包含：filename, storagepath, filesize, lasttimesincechange
// filename: 字符串，表示文件名称
// storagepath: 字符串，表示相对文件路径
// filesize: 数字，表示文件存储空间大小，单位为 Mb
// filedate: 数组，表示日期，[year, month, day, hour, minute, second]
var updateTableData = function (response) {
    // 更新面包屑导航
    updateBreadcrumb(response[0]["directory"]);

    // 建立新的表格
    var table = document.querySelector("table");

    //  移除整个数据列表 & 创建新的数据列表
    if (document.querySelector("table tbody")) {
        table.removeChild(document.querySelector("table tbody"));
    }
    var tbody = createElement("tbody");

    // 依据 response 添加数据
    for (var i = 1; i < response.length; i += 1) {
        // 提取关于文件的信息
        var filename = response[i]["filename"];
        var filepath = response[i]["filepath"];
        var filesize = response[i]["filesize"];
        var filemime = response[i]["filemime"];
        var filedate = response[i]["filedate"];

        // 创建包裹数据的行
        var tr = createElement("tr");

        // 第一列：序号
        var td_index = createElement("td");
        td_index.textContent = String(i);

        // 第二列：文件名
        var td_filename = createElement("td");
        var link_filename = createElement("a", {
            "href": [filepath, filename].join("/"),
            "file-type": response[i]["filemime"]
        });
        link_filename.textContent = filename;
        link_filename.addEventListener("click", getResource);  // 点击时处理请求
        td_filename.appendChild(link_filename);

        // 第三列：文件大小
        var td_filesize = createElement("td");
        td_filesize.textContent = String(filesize + " Mb");

        // 第四列：最后修改日期
        var td_date = createElement("td");
        td_date.textContent = handleDate(filedate);

        // 附加到 tr 中
        tr.appendChild(td_index);
        tr.appendChild(td_filename);
        tr.appendChild(td_filesize);
        tr.appendChild(td_date);

        // 附加到 tbody 中
        tbody.appendChild(tr);
    }

    // 附加到 table 中
    table.appendChild(tbody);
};

// 处理弹出框，上传文件
var link_upload = document.querySelector(".upload-link");
link_upload.addEventListener("click", function (event) {
    // 阻止点击链接的默认行为
    event.preventDefault();

    // 触发弹出框按钮
    var button_upload = document.querySelector(".upload-button");
    button_upload.click();
});

// 上传文件
var btn_upload = document.querySelector("#upload-btn");
btn_upload.addEventListener("click", function (event) {
    // 阻止默认行为
    event.preventDefault();

    // 关闭上传弹出框
    var btn_close = document.querySelector("#modal-close");
    btn_close.click();
    // stopMessage();

    // 获取文件
    var file_input = document.querySelector(".file-input");
    var files = file_input.files;

    // 检测是否真的有文件
    if (!files.length) {
        showMessage("没有添加任何文件！");
        return;
    }

    // 打包文件
    var formData = new FormData();
    for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        formData.append("files", file, file.name);
    }

    // 寻找当前文件夹
    var breadcrumb_li = document.querySelectorAll(".breadcrumb li");
    var upload_dir = "";
    for (i = 0; i < breadcrumb_li.length; i += 1) {
        var li = breadcrumb_li[i];
        upload_dir += "/";
        upload_dir += li.getAttribute("data-dirname");
    }
    console.log(upload_dir);

    // 上传文件
    var options = {
        method: "POST",
        pathname: "/upload" + upload_dir,
        body: formData
    };
    request(options, function (error, response) {
        if (error) {
            showMessage("错误：" + error.toString());
        } else {
            showMessage("上传成功！");
        }
    });


});

// 搜索文件
var search_form = document.querySelector("#search");
search_form.addEventListener("submit", function (event) {
    var search_input = document.querySelector("#search input");

    event.preventDefault();

    var req = new XMLHttpRequest();
    req.open("POST", "/search", true);
    req.addEventListener("load", function () {
        if (req.status < 400) {
            alert(req.responseText);
        }
    });

    req.send("key=" + search_input.value);
});







