/**
 *统一认证跳转
 */
vds.import("vds.expression.*", "vds.browser.*", "vds.string.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			// 获取开发系统配置的参数
			var inParamsObj = ruleContext.getVplatformInput();
			var url = parseUrl(inParamsObj.url, ruleContext);
			var redirectOrigin = new RegExp("^https?://[\\w-.]+(:\\d+)?").exec(url)[0];
			var locationOrigin = location.origin;

			if (redirectOrigin != locationOrigin || url.indexOf("errorMsg") != -1) {
				//不同域名或异常情况，直接将地址设置到地址栏打开
				location.href = url;
			} else {
				//同域名
				var redirectUrl = url.split("redirect_uri=")[1];
				if (redirectUrl) {
					var decodeRedirectUrl = redirectUrl,
						componentCode = "",
						windowCode = "";

					while (decodeRedirectUrl.indexOf("%25") != -1 || decodeRedirectUrl.indexOf("%3A") != -1) {
						decodeRedirectUrl = decodeURIComponent(decodeRedirectUrl);
					}
					var urlParams = getUrlParams(decodeRedirectUrl);

					if (urlParams["componentCode"]) {
						componentCode = urlParams["componentCode"];
					}
					if (urlParams["windowCode"]) {
						windowCode = urlParams["windowCode"];
					}

					var windowCodeIndex = redirectUrl.indexOf(windowCode);
					redirectUrl = redirectUrl.substring(windowCodeIndex + windowCode.length, "");

					var iframe = document.createElement("iframe");
					var staticPagePath = locationOrigin + "/redirect.html";
					iframe.id = vds.string.uuid();
					iframe.src = url.replace(redirectUrl, staticPagePath);
					iframe.style.position = "absolute";
					iframe.style.top = "-9999px";
					var interval = setInterval(function () {
						if (iframe.contentWindow) {
							var href = iframe.contentWindow.location.href;
							if (href.indexOf("errorMsg") != -1) {
								clearInterval(interval);
								location.href = url;
							}
						}
					}, 500)
					createOpenWindowCallback(componentCode, windowCode, interval);
					document.body.appendChild(iframe);
				}
			}
			resolve();
		} catch (e) {
			reject(e);
		}
	});
}

/**
 * 把表达式解析为url
 * @param {String} url
 * @param {RuleContext} ruleContext
 * @return {String}
 */
var parseUrl = function (url, ruleContext) {
	if (!url) {
		return "";
	}
	url = vds.expression.execute(url, {
		"ruleContext": ruleContext
	});
	return url;
}

var uuid;
/**
 * 获取地址参数
 * @param {String} url
 * @return {Object}
 */
var getUrlParams = function (url) {
	var params = {};
	var paramsStr = url.split("?")[1];
	if (paramsStr) {
		var paramInfo = paramsStr.split("&");
		for (var i = 0; i < paramInfo.length; i++) {
			var result = paramInfo[i].split("=");
			params[result[0]] = result[1];
		}
	}
	return params;
}

/**
 * 添加打开方法
 * @param {Stringt} componentCode
 * @param {String} windowCode
 * @param {*} interval
 */
var createOpenWindowCallback = function (componentCode, windowCode, interval) {
	window.openWindow = function () {
		if (interval) {
			clearInterval(interval);
		}
		vds.browser.redirect(componentCode, windowCode);
		// var windowInputParams = {
		// 	variable: {
		// 		formulaOpenMode: "locationHref"
		// 	}
		// }
		// browser.redirectModule({
		// 	"componentCode": componentCode,
		// 	"windowCode": windowCode,
		// 	"params": {
		// 		inputParam: windowInputParams
		// 	}
		// });
	}
}

export {
	main
}