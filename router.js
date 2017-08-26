/**
 * Created by Administrator on 2017/7/3.
 */

var Router = module.exports = function () {
    this.routes = [];
};


Router.prototype.add = function (method, url, handler) {
    this.routes.push({
        method: method,
        url: url,
        handler: handler
    });
};


Router.prototype.resolve = function (request, response) {
    var path = require("url").parse(request.url).pathname;
    console.log(request.method + "  " + path);

    return this.routes.some(function (route) {
        var match = route.url.exec(path);

        if (!match || request.method !== route.method) {
            return false;
        }

        var commend = match.slice(1).map(decodeURIComponent);

        route.handler.apply(null, [request, response].concat(commend));
        return true;
    });
};






