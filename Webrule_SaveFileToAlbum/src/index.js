/**
 *	保存图片到相册
 */
vds.import("vds.expression.*", "vds.exception.*","vds.rpc.*", "vds.app.*");
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
				saveFile(fileUrl, fileName, resolve, reject);
			} else {
				var fileId = value;
				var getFileInfoCB = function (fileName) {
					fileName = fileName.replace(/\s+/g, "");
					if (window.device.platform == "iOS") {
						fileName = new Date().getTime() + "." + getFileNameLast(fileName);
					}
					var getFileUrlByFileIdExp = "GetFileUrlByFileId(\"" + fileId + "\")";
					var getFileUrlCB = function (url) {
						saveFile(url, fileName, resolve, resolve);
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

var saveFile = function (fileUrl, fileName, resolve, reject) {
	var failCB = function (error) {
		reject(vds.exception.newConfigException("保存失败！"));
	};
	var promise = vds.app.saveImage(fileUrl, fileName);
	promise.then(resolve).catch(failCB);
}

/**
 * 执行后台函数（根据文件ID获取文件信息）
 */
var executeExpression = function (expression, callback, reject) {
	var paramData = {
		"expression": expression
	};
	var result = null;
	var promise = vds.rpc.command("WebExecuteFormulaExpression", paramData, {
		"isAsync": false,
		"isRuleSetCode": false
	});
	promise.then(function (rs) {
		result = rs.data.result;
		callback(result);
	}).catch(reject);
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