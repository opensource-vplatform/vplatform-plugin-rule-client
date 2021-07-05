/**
 *	保存图片到相册
 */
vds.import("vds.expression.*","vds.exception.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			if (!inParamsObj) { //建议兼容
				inParamsObj = "";
			}
			var type = inParamsObj.sourceType;
			if (!inParamsObj.sourceValue) {
				reject(vds.exception.newConfigException("文件标识或url不存在，请检查配置"));
				return;
			}
			var value = experssFunc(inParamsObj.sourceValue, ruleContext);
			if (type == "url") {
				var fileUrl = value;
				var fileName = getFileName(fileUrl);
				fileName = fileName.replace(/\s+/g, "");
				if (window.device.platform == "iOS") {
					fileName = new Date().getTime() + "." + getFileNameLast(fileName);
				}
				saveFile(fileUrl, fileName, ruleContext, resolve, reject);
			} else {
				var fileId = value;
				var getFileInfoCB = function (fileName) {
					fileName = fileName.replace(/\s+/g, "");
					if (window.device.platform == "iOS") {
						fileName = new Date().getTime() + "." + getFileNameLast(fileName);
					}
					var getFileUrlByFileIdExp = "GetFileUrlByFileId(\"" + fileId + "\")";
					var getFileUrlCB = function (url) {
						saveFile(url, fileName, ruleContext, resolve, resolve);
					}
					executeExpression(getFileUrlByFileIdExp, getFileUrlCB, reject);
				};
				var getFileInfoExp = "GetFileInfo(\"" + fileId + "\",\"fileName\")";
				executeExpression(getFileInfoExp, getFileInfoCB, reject);
			}
		} catch (err) {
			reject(err);
		}
	});
}

// var saveImageToGalleryService, scopeManager, operation;
// //初始化vjs模块，如果规则逻辑需要引用相关vjs服务，则初始化相关vjs模块；如果不需要初始化逻辑可以为空
// exports.initModule = function (sBox) {
// 	//sBox：前台vjs的沙箱（容器/上下文），可以用它根据vjs名称，获取到相应vjs服务
// 	sandbox = sBox;
// 	scopeManager = sandbox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
// 	saveImageToGalleryService = sandbox.getService("vjs.framework.extension.platform.services.native.mobile.SaveImageToGallery");
// 	operation = sandbox.getService("vjs.framework.extension.platform.services.domain.operation.RemoteOperation");
// }
var saveFile = function (fileUrl, fileName, ruleContext, resolve, reject) {
	var failCB = function (error) {
		reject(vds.exception.newConfigException("保存失败！"));
	};
	var options = {
		fileUrl: fileUrl,
		fileName: fileName
	};
	saveImageToGalleryService.saveimagetogallery(resolve, failCB, options);
}

/**
 * 执行后台函数（根据文件ID获取文件信息）
 */
var executeExpression = function (expression, callback, reject) {
	// var scope = scopeManager.getWindowScope(),
	// 	windowCode = null;
	// if (scope != null) {
	// 	windowCode = scope.getWindowCode();
	// }
	var paramData = {
		"expression": expression
	};
	var result = null;
	operation.request({ ///
		// "windowCode": windowCode,
		"operation": "WebExecuteFormulaExpression",
		"isAsync": false,
		"params": paramData,
		"success": function (rs) {
			result = rs.data.result;
			callback(result);
		},
		"error": function (e) {
			reject(vds.exception.newConfigException(e));
		}
	});
}

/**
 * desc 执行表达式
 * experss 表达式
 * routeContext 路由上下文
 */
var experssFunc = function (experss, ruleContext) {
	if (experss == null || experss == "") {
		return null;
	}
	if (undefined == experss || null == experss) return null;
	var resultValue = vds.expression.execute(experss, {
		"ruleContext": ruleContext
	});
	return resultValue;
}

/**
 * 获取URL后缀
 */
function getFileName(fileName) {
	return fileName.split("/").pop();
}

/**
 * 获取文件名后缀
 */
function getFileNameLast(fileName) {
	return fileName.split(".").pop();
}

export {
	main
}