/**
 * 显示设置的提示信息(用于需要提示用户或者询问用户的场景。)
 */
vds.import("vds.expression.*","vds.message.*");
var SHOWTYPE_ALERT_CONTINUE = "0"; //0:提示，可以继续
var SHOWTYPE_WARN_CONTINUE = "1"; //1:警告，可以继续
var SHOWTYPE_ERROR_STOP = "2"; //2:错误，不能继续
var SHOWTYPE_CONFIRM = "3"; //3:询问（确定/取消），根据用户选择继续或终止
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			var showType = inParamsObj["showType"]; // 提示类型(硬编码来区分类型)
			var secDistance = inParamsObj["time"]; //倒计时
			var simpleChinesePrompt = inParamsObj["simpleChinesePrompt"]; // 简体中文提示
			var msgObj = simpleChinesePrompt; // 获取提示信息内容
			var message = msgObj["msgnote"]; //提示信息(目前只取简体中文);
			var messageType = msgObj["type"]; //提示信息类型0代表非表达式，1代表表达式
			if (undefined == messageType || null == messageType || messageType.length == 0) {
				messageType = 1;
			}
			if ("1" == messageType + "") {
				message = vds.expression.execute(message, {
					"ruleContext": ruleContext
				});
			}

			var userConfirm = true;
			var callback = function (val) {
				userConfirm = typeof (val) == "boolean" ? val : userConfirm;
				setResult(ruleContext, "confirm", userConfirm);
				resolve();
			}
			switch (showType) {
				case SHOWTYPE_ALERT_CONTINUE:
					if (null == secDistance || secDistance == "" || isNaN(secDistance)) {
						secDistance = 3;
					}
					var promise = vds.message.info(message,{
						"time":secDistance
					});
					promise.then(callback).catch(reject);
					break;
				case SHOWTYPE_WARN_CONTINUE:
					var promise = vds.message.warn(message);
					promise.then(callback).catch(reject);
					break;
				case SHOWTYPE_ERROR_STOP:
					var promise = vds.message.error(message);
					promise.then(callback).catch(reject);
					break;
				case SHOWTYPE_CONFIRM:
					var promise = vds.message.confirm(message);
					promise.then(callback).catch(reject);
					break;
				default:
					callback(true);
					break;
			}
		} catch (err) {
			reject(err);
		}
	});
}
/**
 * 设置规则返回值
 * @param {RuleContext} ruleContext 规则上下文
 * @param {String} code 返回值编码
 * @param {Any} value 值
 */
var setResult = function (ruleContext, code, value) {
	if (ruleContext.setResult) {
		ruleContext.setResult(code, value)
	}
}

export {
	main
}