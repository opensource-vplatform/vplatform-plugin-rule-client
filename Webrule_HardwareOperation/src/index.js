/**
 *
 *
 */
 vds.import("vds.app.*","vds.log.*","vds.expression.*")
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var _finish = true;
			var inParamObj = ruleContext.getVplatformInput();
			if (!inParamObj) { //建议兼容
				inParamObj = "";
			}
			if (inParamObj.operationType == "flashOn") {
				vds.app.openFlashLight();
			} else if (inParamObj.operationType == "flashOff") {
				vds.app.closeFlashLight();
			} else if (inParamObj.operationType == "brightness") {
				var inputParam = inParamObj.inputParams[0];
				if (inputParam.paramCode == "lightenessValue" && inputParam.paramType == "expression") {
					var lightnessValue = expressFunc(inputParam.paramValue, ruleContext);
					lightnessValue = Number(lightnessValue);
					if(isNaN(lightnessValue)){
						vds.log.error("亮度参数值无效："+lightnessValue);
						resolve();
						return;
					}
					vds.app.setScreenBrightness(lightnessValue);
				} else {
					//TODO 抛出“无效参数”异常
					vds.log.error("无效参数");
				}
			} else if (inParamObj.operationType == "getGPSOpenstate") {
				_finish = false;
				var success = function (s) {
					setResult(ruleContext, inParamObj.returnResult, s);
					resolve();
				}
				var error = function (message) {
					//TODO 异常处理
					vds.log.error("执行getGPSStatus发生错误。" + message);
					resolve();
				}
				var promise = vds.app.getGPSStatus();
				promise.then(success).catch(error);
			} else if (inParamObj.operationType == "getBluetoothOpenstate") {
				_finish = false;
				var success = function (s) {
					var statu = 0;
					switch (s) {
						case vds.app.BluetoothStatus.OPEN:
							statu = 1;
							break;
						case vds.app.BluetoothStatus.CLOSE:
							statu = 2;
							break;
					}
					setResult(ruleContext, inParamObj.returnResult, statu);
					resolve();
				}
				var error = function (message) {
					//TODO 异常处理
					vds.log.error("执行getBluetoothStatus发生错误。" + message);
					resolve();
				}
				var promise = vds.app.getBluetoothStatus();
				promise.then(success).catch(error);
			} else if (inParamObj.operationType == "getCurrentNetworkstatus") {
				_finish = false;
				var success = function (s) {
					var statu = "other";
					switch (s) {
						case vds.app.NetworkStatus.WIFI:
							statu = "wifi";
							break;
						case vds.app.NetworkStatus.MOBILE:
							statu = "mobile";
							break;
						case vds.app.NetworkStatus.NONE:
							statu = "no";
							break;
					}
					setResult(ruleContext, inParamObj.returnResult, statu);
					resolve();
				}
				var error = function (message) {
					//TODO 异常处理
					vds.log.error("执行getNetworkStatus发生错误。" + message);
					resolve();
				}
				var promise = vds.app.getNetworkStatus();
				promise.then(success).catch(error);
			} else if (inParamObj.operationType == "setShock") {
				var inputParam = inParamObj.inputParams[0];
				if (inputParam.paramCode == "shockSeconds" && inputParam.paramType == "expression") {
					var shockSeconds = expressFunc(inputParam.paramValue, ruleContext);
					vds.app.vibrate(shockSeconds);
				} else {
					//TODO 抛出“无效参数”异常
					vds.log.error("无效参数");
				}
			} else {
				//TODO 抛出 "无效操作"异常
				vds.log.error("无效操作类型。" + inParamObj.operationType);
			}
			if (_finish) {
				resolve();
			}
		} catch (err) {
			reject(err);
		}
	});
}
function expressFunc(experss, ruleContext) {
	if (experss == null || experss == "") {
		return null;
	}
	var resultValue = vds.expression.execute(experss, {
		"ruleContext": ruleContext
	});
	return resultValue;
}

function setResult(ruleContext, returnResult, resultValue) {
	for (var i = 0; i < returnResult.length; i++) {
		var resultType = returnResult[i].resultType;
		var resultName = returnResult[i].resultValue;
		if (resultType == "ruleSetVar") {
			ruleContext.getMethodContext().setVariable(resultName, resultValue);
		} else if (resultType == "ruleSetOutput") {
			ruleContext.getMethodContext().setOutput(resultName, resultValue);
		} else {
			//TODO 警告“无效返回类型”
			vds.log.warn("无效的返回类型：" + resultType);
		}
	}
}

export {
	main
}