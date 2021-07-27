/**
 * 打开链接地址
 *
 *{
 *	"urlType": "0",
 *	"url":  "http://www.baidu.com",
 *	"targetType": "0",
 *	"targetComponentContainerCode": "",
 *	"parameters": [{
 *		"name": "account",
 *		"value": "test"
 *	},
 *	{
 *		"name": "password",
 *		"value": "UserTable.password"
 *	},
 *	{
 *		"name": "sex",
 *		"value": "systemVarSex"
 *	},
 *	{
 *		"name": "age",
 *		"value": "componentVarAge"
 *	},
 *	]
 *}
 *
 */
/**
 *	
 */
vds.import("vds.expression.*","vds.exception.*","vds.log.*","vds.browser.*","vds.string.*","vds.environment.*","vds.widget.*","vds.window.*","vds.component.*","vds.ds.*")
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamObj = ruleContext.getVplatformInput();
			if (!inParamObj) { //建议兼容
				inParamObj = "";
			}
			var urlstr = inParamObj.url;
			var targetType = inParamObj.targetType;
			var isEncodeURL = inParamObj.isEncodeURL;
			var isShowDialog = inParamObj.isShowDialog ? inParamObj.isShowDialog : false;
			var targetComponentContainerCode = inParamObj.targetComponentContainerCode;
			var paramsArray = inParamObj.parameters;
			var url = vds.expression.execute(urlstr, {
				"ruleContext": ruleContext
			});


			//"打开页面"
			var titleExp = inParamObj.title;
			var title;
			if (!titleExp) {
				title = "打开页面";
			} else {
				title = vds.expression.execute(titleExp, {
					"ruleContext": ruleContext
				});
			}
			var paramStr = "";
			for (var i = 0; paramsArray != null && i < paramsArray.length; i++) {
				var paramName = paramsArray[i].name;
				var paramValue = getData(paramsArray[i].value, ruleContext);
				if (paramStr.length > 0)
					paramStr += "&";
				paramStr += paramName + "=" + paramValue;
			}

			var errorMsg = null;
			if (url == null || url.lenght == 0) {
				errorMsg = "打开链接地址不能为空！";
			}
			if (targetType != TARGET_TYPE_CUR_PAGE &&
				targetType != TARGET_TYPE_NEW_WINDOW &&
				targetType != TARGET_TYPE_COMPONENT_CONTAINER &&
				targetType != TARGET_TYPE_DIV_CONTAINER &&
				targetType != TARGET_TYPE_COMPONENT_NEW_TAB &&
				targetType != TARGET_TYPE_IEMS_HOME_TAB) {
				errorMsg = "目标窗口类型不正确！";
			}

			if (errorMsg != null && errorMsg.length > 0) {
				throw vds.exception.newConfigException(errorMsg);
			}

			if (paramStr.length > 0) {
				var pos = url.indexOf("?");
				if (pos < 0)
					url += "?";
				else if (pos < (url.length - 1))
					url += "&";
				url += paramStr;
			}
			if (isEncodeURL != undefined && (isEncodeURL == true || isEncodeURL == "true")) {
				url = encodeURI(url);
			}

			vds.log.log("打开链接地址为：" + url);
			setResult(ruleContext, "isConfirmSelectionOnClose", undefined); //兼容其他方式使用返回值报错的问题
			var isFinish = true;
			//当前页面打开
			if (targetType == TARGET_TYPE_CUR_PAGE) {
				vds.browser.redirectByUrl({
					url: url
				});
				//			window.location.href=url;
			} else if (targetType == TARGET_TYPE_COMPONENT_NEW_TAB) {
				/* 新页签打开方式 */
				var widthExp = inParamObj.widthExp;
				var heightExp = inParamObj.heightExp;
				var width = null;
				if (widthExp != null && widthExp != "") {
					width = parseInt("" + vds.expression.execute(widthExp, {
						"ruleContext": ruleContext
					}));
					if (isNaN(width))
						width = null;
				}

				var height = null;
				if (heightExp != null && heightExp != "") {
					height = parseInt("" + vds.expression.execute(heightExp, {
						"ruleContext": ruleContext
					}));
					if (isNaN(height))
						height = null;
				}
				var tabName = vds.string.toMD5(url);
				isFinish = false;
				var params = {
					"winName": tabName,
					"title": title,
					"width": width,
					"height": height,
					"closed": (function (context) { //关闭回调
						return function () {
							// context.fireRuleCallback();
							resolve();
						}
					})(ruleContext)
				}
				vds.browser.newTab(url, params);
			} else if (targetType == TARGET_TYPE_NEW_WINDOW) {
				if (!vds.environment.isMobileWindow()) {
					var widthExp = inParamObj.widthExp;
					var heightExp = inParamObj.heightExp;
					var width = null;
					if (widthExp != null && widthExp != "") {
						width = parseInt("" + vds.expression.execute(widthExp, {
							"ruleContext": ruleContext
						}));
						if (isNaN(width))
							width = null;
					}

					var height = null;
					if (heightExp != null && heightExp != "") {
						height = parseInt("" + vds.expression.execute(heightExp, {
							"ruleContext": ruleContext
						}));
						if (isNaN(height))
							height = null;
					}
					var winName = vds.string.uuid();
					var params = {
						"winName": winName,
						"url": url,
						"title": title,
						"width": width,
						"height": height
					}
					var callback = resolve;
					if (isShowDialog) {
						isFinish = false;
						var returnMappings = inParamObj.returnMapping;
						callback = ruleContext.genAsynCallback(function (params) {
							if (params && params.isClickConfirm && returnMappings) {
								handleOpenWindowReturnValues(ruleContext, params.outputs, returnMappings);
							}
							setResult(ruleContext, "isConfirmSelectionOnClose", params && params.isClickConfirm);
							resolve();
						})
						var promise = vds.browser.dialog(url, params);
						promise.then(callback).catch(reject);
					} else {
						params.primordial = true;
						params.winName = params.winName;
						vds.browser.newTab(url, params);
					}
				} else {
					var userAgent = navigator.userAgent;
					if (isShowDialog && userAgent.indexOf("v3app") < 1 && userAgent.indexOf("ydgApp") < 1) {
						var params = {
							// url: url,
							title: title
						}
						// params["callback"] = function () {
						// 	resolve();
						// }
						// vds.widget.execute(vds.window.getCode(), "showModalUrl", [params]);
						var promise = vds.browser.dialog(url, params);
						promise.then(resolve).catch(reject);
					} else {
						// var config = {};
						// config.url = url; //创建webview后请求的url地址，需要带http://或https://            （打开H5窗体时必填）
						// config.onClose = function () {
						// 	resolve();
						// };
						// webViewService.openUrl(config);//???
						var promise = vds.browser.dialog(url);
						promise.then(resolve).catch(reject);
					}
				}
				//			rendererUtil.showModelessDialogEx("openLink", url, title,null,width,height);
			} else if (targetType == TARGET_TYPE_COMPONENT_CONTAINER) {
				var targetComponentContainerId = targetComponentContainerCode;

				//			//非空说明是当前组件容器
				//			if(targetComponentContainerId!=null && targetComponentContainerId!="")
				//			    tmpActionHandler=widgetAction;
				//			else{
				//			    tmpActionHandler=rendererUtil.getParentActionHandler(targetComponentContainerCode);
				//如果没有找到父容器则用新窗口打开
				//			    if(tmpActionHandler==null){
				//			    	Browser.showModelessDialogEx("openLink", url, title);
				//			    	Browser.showModelessDialogEx("openLink", url, title);
				//			        return true;
				//			    }
				//			}

				var width = screen.availWidth;
				var height = screen.availHeight;
				var info = {};
				info.title = title;
				info.otherInfo = url;
				// 标注打开方式为container
				var containerId = vds.widget.execute(targetComponentContainerId, "exists", [info]);
				if (containerId) {
					//因为可能有数据更新了，要先刷新,刷新后再激活
					vds.widget.execute(targetComponentContainerId, "reloadSingleTab", ["", containerId, title, info.otherInfo, url, true, false]);
					vds.widget.execute(targetComponentContainerId, "active", [info]);
				} else {
					vds.widget.execute(targetComponentContainerId, "add", [{
						"id": null,
						"isComponent": false,
						"title": title,
						"url": url,
						"iconCls": "icon-save",
						"selected": true
					}, 0]);
				}
			} else if (targetType == TARGET_TYPE_DIV_CONTAINER) { //在div容器打开
				//			windowInputParams["variable"]["formulaOpenMode"] = "vuiWindowContainer";
				// var widgetId = inParamObj.divCode;
				// var containerCode = inParamObj.targetComponentContainerCode;
				// var _setWidget = ruleContext.genAsynCallback(function (_closeParams) {
				// 	return function(){
				// 		vds.widget.execute(widgetId, "setfireVueEvent", [_closeParams]);
				// 	}
				// })
				// var callBackFunc = function (params) {
				// 	if (!params)
				// 		return;
				// 	var exist = params.existIden === true ? true : false;
				// 	if (!exist) { //之前未打开过
				// 		var closeParams = {
				// 			widgetId: widgetId,
				// 			vuiCode: containerCode,
				// 			eventName: "close",
				// 			params: {
				// 				tagIden: params._iden
				// 			}
				// 		}
				// 		var closeFunc = _setWidget(closeParams);
				// 		//注册跨域关闭事件
				// 		eventManager.onCrossDomainEvent({//???应该在控件内部处理
				// 			eventName: eventManager.CrossDomainEvents.ContainerWindowClose,
				// 			handler: closeFunc
				// 		});
				// 	}
				// }
				// var closeback = function (params) {}

				// var containerParam = {
				// 	containerCode: containerCode,
				// 	/* 这个是标签的code */
				// 	// componentCode: componentCode,
				// 	// windowCode: windowCode,
				// 	OpenMode: "OpenLink",
				// 	callback: callBackFunc,
				// 	closeback: closeback,
				// 	url: url,
				// 	divCode: widgetId,
				// 	/* 这个是标签所在div的code */
				// 	title: title
				// }
				// vds.widget.execute(widgetId, "setopenWindowToDivContainer", [containerParam]);
				isFinish = false;
				var promise = vds.browser.renderToDivContainerByUrl(url, widgetId, containerCode, {
					title:title,
					ruleContext:ruleContext
				});
				promise.then(reject).catch(reject);
			} else if (targetType == TARGET_TYPE_IEMS_HOME_TAB) {
				isFinish = false;
				var returnMappings;
				var _callbackLabel = function (params) {
					var businessRuleResult = {
						isConfirmSelectionOnClose: false
					}
					if (params) {
						businessRuleResult.isConfirmSelectionOnClose = true === params.isConfirmExit;
						if (businessRuleResult.isConfirmSelectionOnClose && params.returnValues) {
							handleOpenWindowReturnValues(ruleContext, params.returnValues, returnMappings);
						}
					}
					if (setResult) {
						setResult(ruleContext, "isConfirmSelectionOnClose", businessRuleResult["isConfirmSelectionOnClose"]);
					}
					resolve();
				}
				var promise = vds.browser.renderToHomeTabByUrl(url, {
					"title": title,
					"ruleContext": ruleContext
				});
				promise.then(_callbackLabel).catch(reject);
			}
			if (isFinish)
				resolve();
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
//dengb:去掉来源类型的判断逻辑，现在只要一直来源就是表达式
//值类型(1:实体字段,2:系统变量,3:组件变量,4:常量,5:自定义,6:表达式)
/*var TYPE_ENTITY_FIELD='1';
var TYPE_SYSTEM_VARIABLE = '2';
var TYPE_COMPONENT_VARIABLE = '3';
var TYPE_CONST = '4';
var TYPE_CUSTOM = '5';
var TYPE_EXPRESSION = '6';*/

//目标窗口类型(0:当前页面,1:新窗口,2:当前组件容器,3:父亲组件容器,4:div容器,5:首页页签)
var TARGET_TYPE_CUR_PAGE = 0;
var TARGET_TYPE_NEW_WINDOW = 1;
var TARGET_TYPE_COMPONENT_CONTAINER = 2;
var TARGET_TYPE_COMPONENT_NEW_TAB = 3;
var TARGET_TYPE_DIV_CONTAINER = 4;
var TARGET_TYPE_IEMS_HOME_TAB = 5;


/**
 * 处理打开窗体返回信息
 */
function handleOpenWindowReturnValues(ruleContext, windowReturnValue, returnMappings) {
	if (!returnMappings || returnMappings.length <= 0) {
		return;
	}

	/**
	 * 内部方法，获取赋值来源值
	 */
	var getSourceValue = function (source, sourceType) {
		var sourceValue = null;
		switch (sourceType) {
			case "returnValue":
				sourceValue = windowReturnValue[source];
				break;
			case "expression":
				sourceValue = vds.expression.execute(source, {
					"ruleContext": ruleContext
				});
				break;
			default:
				break;
		}
		return sourceValue;
	};

	for (var i = 0; i < returnMappings.length; i++) {
		var mappings = returnMappings[i];
		var destName = mappings["dest"];
		var destType = mappings["destType"];

		var sourceName = mappings["src"];
		var sourceType = mappings["srcType"];
		var sourceValue = getSourceValue(sourceName, sourceType);
		var _info = _getInfo(destName, destType, ruleContext);
		if (!_info.isEntity) { //暂不支持实体
			switch (destType) {
				case "control":
					var dsName = vds.widget.getDatasourceCodes(destName)[0];
					var field = vds.widget.getFieldCodes(dsName, destName)[0];
					setFieldValue({
						"datasourceName": dsName,
						"fieldCode": field,
						"value": sourceValue
					});
					break;
				case "windowVariant":
					vds.window.setInput(destName, sourceValue);
					break;
				case "systemVariant":
					vds.component.setVariant(destName, sourceValue);
					break;
				case "ruleSetVariant":
					ruleContext.getMethodContext().setVariable(destName, sourceValue);
					break;
				case "ruleSetOutput":
					ruleContext.getMethodContext().setOutputParam(destName, sourceValue);
					break;
				case "windowOutput":
					vds.window.setOutput(destName, sourceValue);
					break;
				default:
					break;
			}
		}
	}
};

var setFieldValue = function (params) {
	var dsName = params.datasourceName,
		code = params.fieldCode,
		val = params.value;
	var datasource = vds.ds.lookup(dsName);
	var record = datasource.getCurrentRecord();
	if (!record) {
		record = datasource.createRecord();
		datasource.insertRecords([record]);
	}
	record.set(code, val);
	datasource.updateRecords([record]);
}

var _getInfo = function (entityName, entityType, methodContext) {
	var info = {
		isEntity: false,
		ds: null,
	}
	// 界面实体：开发系统中，有的规则用entity有的规则用window，此处做兼容
	if (entityType == "entity" || entityType == "window") {
		info.isEntity = true;
		info.ds = vds.ds.lookup(entityName);
	}
	// 窗体输入变量：开发系统中，有的规则用windowVariant有的规则用windowInput，此处做兼容
	else if (entityType == "windowVariant" || entityType == "windowInput") {
		var input = vds.window.getInputType(entityName);
		if (input == "entity") {
			info.isEntity = true;
			info.ds = vds.window.getInput(entityName);
		}
	}
	// 窗体输出变量
	else if (entityType == "windowOutput") {
		var output = vds.window.getOutputType(entityName);
		if (output == "entity") {
			info.isEntity = true;
			info.ds = vds.window.getOutput(entityName);
		}
	}
	// 方法输入变量
	else if (entityType == "ruleSetInput") {
		var varType = methodContext.getInputType(entityName);
		if (varType == "entity") {
			info.isEntity = true;
			info.ds = methodContext.getInput(entityName);
		}
	}
	// 方法输出变量
	else if (entityType == "ruleSetOutput") {
		var varType = methodContext.getOutputType(entityName);
		if (varType == "entity") {
			info.isEntity = true;
			info.ds = methodContext.getOutput(entityName);
		}
	}
	// 方法变量：开发系统中，有的规则用ruleSetVariant有的规则用ruleSetVar，此处做兼容
	else if (entityType == "ruleSetVariant" || entityType == "ruleSetVar") {
		var varType = methodContext.getVariableType(entityName);
		if (varType == "entity") {
			info.isEntity = true;
			info.ds = methodContext.getVariable(entityName);
		}
	}
	return info;
}

function getData(value, ruleContext) {
	if (value == null)
		return "";
	var val = "";
	val = vds.expression.execute(value, {
		"ruleContext": ruleContext
	});
	val += ""; //转换成字符串，否则传递到后台的参数可能不是字符串类型而出错
	return val;
}

export {
	main
}