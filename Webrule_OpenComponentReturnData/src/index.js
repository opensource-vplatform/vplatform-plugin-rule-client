/**
 * 打开组件并返回数据
 */
vds.import("vds.component.*","vds.log.*","vds.browser.*","vds.expression.*","vds.exception.*","vds.ds.*","vds.widget.*","vds.window.*","vds.object.*","vds.string.*")
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParams = ruleContext.getVplatformInput();
			if (!inParams) { //建议兼容
				inParams = "";
			}
			var openWindowType = inParams["openType"];
			// var routeContext = ruleContext.getMethodContext();
			var businessRuleResult = {};
			var title = getOpenWindowTitle(inParams, ruleContext);
			var componentCode = vds.component.getCode();
			var windowCode = getOpenWindowCode(inParams, ruleContext);
			var windowInputParams = getOpenWindowInputParams(ruleContext, inParams["inputParams"]);
			if (openWindowType == "fromParam") {
				openWindowParam = getOpenParam(inParams, ruleContext);
			} else {
				// 如果打开窗口编号带有.则拆分并映射到构件编号和窗体编号上     
				if (windowCode.indexOf(".") != -1) {
					componentCode = windowCode.split(".")[0];
					windowCode = windowCode.split(".")[1];
				}
			}
			var newConfig = getMappingWindowInfo(componentCode, windowCode);
			componentCode = newConfig.componentCode;
			windowCode = newConfig.windowCode;
			if (!(componentCode && windowCode)) {
				vds.log.error("打开的窗体构件code或窗体code为空，构件code为：" + componentCode + "窗体code为：" + windowCode);
				return;
			}
			var openType = inParams["targetContainerType"];
			//start
			// var renderer = sandBox.getService("vjs.framework.extension.platform.services.view.window.render.mode", {
			// 	type: openType
			// });
			var isFinish = false;
			switch (openType) {
				case "currentWindow": //当前窗体跳转
					isFinish = true;
					vds.browser.redirect(componentCode, windowCode, {
						"inputParams": windowInputParams,
						"windowTitle": title
					})
					break;
				case "dialogWindow": //对话框模态
					render({
						componentCode: componentCode,
						windowCode: windowCode,
						inputs: windowInputParams,
						title: title,
						ruleContext: ruleContext,
						inParams: inParams,
						businessRuleResult: businessRuleResult
					}, resolve, reject)
					break;
				case "windowContainer": //窗体容器
					var promise = vds.browser.renderToContainer(componentCode, windowCode, inParams.windowContainer, {
						"inputParams": windowInputParams,
						"title": title,
						"ruleContext": ruleContext
					});
					promise.then(function(windowInstanceCode){
						setResult(ruleContext,"windowInstanceCode", windowInstanceCode);
						setResult(ruleContext, "isConfirmSelectionOnClose", false);
						resolve();
					}).catch(reject);
					break;
				case "divWindowContainer": //div容器
					var widgetCode = inParams.divCode;
					var divContainerCode = inParams.windowContainer;
					if (inParams.isDynamicContainer === true && divContainerCode) {
						divContainerCode = vds.expression.execute(divContainerCode, {
							"ruleContext": ruleContext
						})
					}
					var promise = vds.browser.renderToDivContainer(componentCode, windowCode, widgetCode, divContainerCode, {
						"inputParams": windowInputParams,
						"title": title,
						"ruleContext": ruleContext
					});
					promise.then(function(windowInstanceCode){
						setResult(ruleContext,"windowInstanceCode", windowInstanceCode);
						setResult(ruleContext, "isConfirmSelectionOnClose", false);
						resolve();
					}).catch(reject);
					break;
				case "newWindow": //新窗体
					isFinish = true;
					vds.browser.newWindow(componentCode, windowCode, {
						"inputParams": windowInputParams,
						"title": title,
						"ruleContext": ruleContext
					});
					break;
				case "appointWindow": //指定窗体
					if(!inParams.browerWindowFlag){
						inParams.browerWindowFlag = "_blank";
					}
				case "currentWindowRedirection": //浏览器刷新
					isFinish = true;
					var winName = inParams.browerWindowFlag;
					vds.browser.refresh(componentCode, windowCode, {
						"inputParams": windowInputParams,
						"title": title,
						"ruleContext": ruleContext,
						"winName": winName
					});
					break;
				case "iemsHomeTab": //首页
					var promise = vds.browser.renderToHomeTab(componentCode, windowCode, {
						"inputParams": windowInputParams,
						"title": title,
						"ruleContext": ruleContext
					});
					promise.then(function(isConfirmExit, output){
						setResult(ruleContext, "isConfirmSelectionOnClose", isConfirmExit);
						setResult(ruleContext, "windowInstanceCode", "");
						resolve();
					}).catch(reject);
					break;
				default:
					throw vds.exception.newConfigException("不正确的打开方式：" + openType);
			}
			// 设置业务返回值  	
			if (openType != "windowContainer") {
				setResult(ruleContext, "isConfirmSelectionOnClose", false);
				setResult(ruleContext, "windowInstanceCode", "");
			}
			if (isFinish) {
				resolve();
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

var render = function (params, resolve, reject) {
	// 模态窗体打开，并处理返回值信息
	/**
	 *   dialogType
	 *   dialogFlag
	 *   openLocation
	 *   heightType
	 *   heightExp:
	 *   heightUnit
	 *   widthType
	 *   widthExp
	 *   widthUnit
	 *   isPushMainWindow 
	 * */
	var componentCode = params.componentCode;
	var windowCode = params.windowCode;
	var title = params.title;
	var inParams = params.inParams;
	var windowInputParams = params.inputs;
	var ruleContext = params.ruleContext;
	var businessRuleResult = params.businessRuleResult;

	// windowInputParams["variable"]["formulaOpenMode"] = "dialog";
	//移动控件
	if (inParams.dialogType) {
		var _dialogParams = {}
		_dialogParams.dialogType = inParams.dialogType;
		_dialogParams.dialogFlag = inParams.dialogFlag;
		_dialogParams.openLocation = inParams.openLocation;
		_dialogParams.heightType = inParams.heightType;
		_dialogParams.heightExp = inParams.heightExp == "" ? "" : getParam(inParams, ruleContext, "heightExp");
		_dialogParams.heightUnit = inParams.heightUnit;
		_dialogParams.widthType = inParams.widthType;
		_dialogParams.widthExp = inParams.widthExp == "" ? "" : getParam(inParams, ruleContext, "widthExp");
		_dialogParams.widthUnit = inParams.widthUnit;
		_dialogParams.isPushMainWindow = inParams.isPushMainWindow;
		windowInputParams["dialogParams"] = _dialogParams;
		_dialogParams = null;
	}
	var height = getOpenWindowHeight(inParams, ruleContext);
	var width = getOpenWindowWidth(inParams, ruleContext);
	var returnMappings = inParams["returnMapping"];
	openDialogWindow(ruleContext, businessRuleResult, componentCode, windowCode, windowInputParams, returnMappings, title, height, width, resolve, reject)
}

/**
 * 获取打开窗体高度 
 */
var getOpenWindowHeight = function (inParams, ruleContext) {

	var heightExp = inParams["heightExp"];
	if (!heightExp) {
		return null;
	}
	var retValue = vds.expression.execute(heightExp, {
		"ruleContext": ruleContext
	});
	return retValue;
};

/**
 * 获取打开窗体宽度
 */
var getOpenWindowWidth = function (inParams, ruleContext) {

	var widthExp = inParams["widthExp"];
	if (!widthExp) {
		return null;
	}
	var retValue = vds.expression.execute(widthExp, {
		"ruleContext": ruleContext
	});
	return retValue;
};

/**
 * 处理打开窗体返回信息
 */
var handleOpenWindowReturnValues = function (ruleContext, windowReturnValue, returnMappings) {
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


		/**
		 * 2015-05-09 liangchaohui：<br>
		 * 修改insertOrUpdateRecords2Entity，操作类型为更新时，如果目标实体没有匹配id的记录，则不做任何操作，原来没匹配id时会新增记录<br>
		 * 如果目标是实体类型时，走dbService.insertOrUpdateRecords2Entity，如果是其他类型，则走原来直接赋值的逻辑<br>
		 * 原来case "entity"分支，由于目标是实体类型，所以已经抽到dbService.insertOrUpdateRecords2Entity中实现，所以在else分支中删除该逻辑<br>
		 */
		var _info = _getInfo(destName, destType, ruleContext.getMethodContext());
		if (_info.isEntity) {
			// 如果实体不存在 则不执行更新数据
			if (sourceValue) {
				var targetDs = _info.ds;
				var destFieldMapping = mappings["destFieldMapping"];
				var newMappings = [];
				if (destFieldMapping) {
					var newMappings = [];
					for (var j = 0, len = destFieldMapping.length; j < len; j++) {
						newMappings.push({
							"code": destFieldMapping[j]["destField"],
							"type": destFieldMapping[j]["srcValueType"],
							"value": destFieldMapping[j]["srcValue"]
						})
					}
				}
				var updateDestEntityMethod = mappings["updateDestEntityMethod"];
				if (updateDestEntityMethod == null) {
					updateDestEntityMethod = "insertOrUpdateBySameId";
				}
				var isCleanDestEntityData = mappings["isCleanDestEntityData"];
				var srcRecords = sourceValue.getAllRecords();
				var isClear = false;
				var mergeType;
				switch (updateDestEntityMethod) {
					case "loadRecord":
						mergeType = vds.ds.MergeType.Load;
						isClear = true;
						break;
					case "updateRecord":
						mergeType = vds.ds.MergeType.Update;
						break;
					default:
						mergeType = vds.ds.MergeType.InsertOrUpdate;
						isClear = isCleanDestEntityData;
						break;
				}
				vds.ds.merge(targetDs, srcRecords, newMappings, mergeType, ruleContext.getMethodContext(), {
					"isClear": isClear
				});
			}
		} else {
			switch (destType) {
				case "control":
					var dsName = vds.widget.getDatasourceCodes(destName)[0];
					//var record = dataSource.getCurrentRecord();
					var field = vds.widget.getFieldCodes(dsName, destName)[0];
					//record.set(field, sourceValue);
					var datasource = vds.ds.lookup(dsName);
					var record = datasource.getCurrentRecord();
					if (!record) {
						record = datasource.createRecord();
						datasource.insertRecords([record]);
					}
					record.set(field, sourceValue);
					datasource.updateRecords([record]);
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
					ruleContext.getMethodContext().setOutput(destName, sourceValue);
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

/**
 * 打开模态窗体，并处理窗体返回值
 */
var openDialogWindow = function (ruleContext, businessRuleResult, componentCode, windowCode, windowInputParams, returnMappings, title, height, width, resolve, reject) {
	var returnMappingsConfig = returnMappings;
	// 标注打开方式为dialog模态窗口  
	var routeCallback = function (output) {
		businessRuleResult["isConfirmSelectionOnClose"] = false;
		if (output && output["config"]) {
			//点击了确定选择
			if (output["config"]["isSelectionConfirm"] == true) {
				businessRuleResult["isConfirmSelectionOnClose"] = true;
			}
			//有返回输出值
			if (output["config"]["isReturnValues"] == true) {
				var windowReturnValue = output["values"];
				var returnMappings = returnMappingsConfig;
				try {
					handleOpenWindowReturnValues(ruleContext, windowReturnValue, returnMappings);
				} catch (e) {
					reject(e);
					return;
				}
			}
		}
		for (var key in businessRuleResult) {
			if (businessRuleResult.hasOwnProperty(key)) {
				setResult(ruleContext, key, businessRuleResult[key]);
			}
		}
		resolve();
	}
	routeCallback = ruleContext.genAsynCallback(routeCallback);
	// ruleContext.on({
	// 	"eventName": ruleContext.Events.ROUTECALLBACK,
	// 	"handler": routeCallback
	// });
	// var callBackFunc = function (output) {
	// 	ruleContext.fireRuleCallback();
	// 	ruleContext.fireRouteCallback(output);
	// }

	// var errorCallback = scopeManager.createScopeHandler({
	// 	handler: function (e) {
	// 		// throw ruleEngine.createRuleException({
	// 		// 	ruleContext: ruleContext,
	// 		// 	exception: e
	// 		// });
	// 		reject(e);
	// 	}
	// })
	// ruleContext.markRouteExecuteUnAuto();

	// var windowInstanceCode = 
	var promise = vds.browser.dialogWindow(componentCode, windowCode, {
		"title": title,
		"inputParams": windowInputParams,
		"closeCallback": routeCallback,
		"width": width,
		// "extraParams": {
		// 	"errorCallback": errorCallback
		// },
		"height": height
	});
	promise.then(routeCallback).catch(reject);
	// businessRuleResult["windowInstanceCode"] = windowInstanceCode;
};

/**
 * 获取模拟框参数
 */
var getParam = function (inParams, ruleContext, valName) {
	var sourceValue = inParams[valName];
	// 默认按表达式取
	var openParam = vds.expression.execute(sourceValue, {
		"ruleContext": ruleContext
	});
	try {
		openParam = vds.object.stringify(openParam);
	} catch (e) {
		console.error("打开组件发生错误，当前为根据参数打开窗体，但参数格式不正确，当前参数：[" + openParam + "]," + e);
		var _un;
		return _un;
		//throw vds.exception.newConfigException("打开组件发生错误，当前为根据参数打开窗体，但参数格式不正确，当前参数：["+openParam+"]," + e);
	}
	return openParam
}

var browser;
var scopeManager;
exports.initModule = function (sBox) {
	scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
	browser = sBox.getService("vjs.framework.extension.platform.services.browser.Browser");
};

/**
 * 获取打开窗体标题 
 */
var getOpenWindowTitle = function (inParams, ruleContext) {
	// 窗体标题
	var titleExp = inParams["browerWindowTitle"];
	if (!titleExp) {
		return null;
	}
	var retValue = vds.expression.execute(titleExp, {
		"ruleContext": ruleContext
	});
	return retValue;
};

/**
 * 获取打开窗体的编号
 */
var getOpenWindowCode = function (inParams, ruleContext) {
	var openType = inParams["openType"];
	var windowCode = null;
	switch (openType) {
		case "fromParam":
			var sourceValue = inParams["windowNumSource"];
			// 默认按表达式取
			openParam = vds.expression.execute(sourceValue, {
				"ruleContext": ruleContext
			});
			try {
				openParam = vds.object.stringify(openParam);
				windowCode = openParam.windowCode
			} catch (e) {
				throw vds.exception.newConfigException("打开组件发生错误，当前为根据参数打开窗体，但参数格式不正确，当前参数：[" + openParam + "]," + e);
			}
			if (!windowCode) {
				throw vds.exception.newConfigException("打开组件发生错误，当前为根据参数打开窗体，但窗体编号并没有指定");
			}
			break;
		case "appoint":
			// 指定窗体
			windowCode = inParams["windowCode"];
			if (!windowCode) {
				throw vds.exception.newConfigException("打开组件发生错误，当前为打开指定窗体，但窗体编号并没有指定");
			}
			break;
		case "dynamic":
			// 动态窗体
			var windowCode = null;
			var dynamicType = inParams["windowNumSourceType"];
			var dynamicValue = inParams["windowNumSource"];
			switch (dynamicType) {
				case "entityField":
					// 动态来源为表字段
					if (!dynamicValue || dynamicValue.indexOf(".") == -1) {
						throw vds.exception.newConfigException("打开组件发生错误，当前为打开动态窗体，但来源字段格式不正确:" + dynamicValue + "。应为表名.字段名格式");
					}
					var dataSourceName = componentSrcValue.split(".")[0];
					// windowCode = viewModel.getDataModule().getSingleValueByDS(dataSourceName, dynamicValue);
					var datasource = vds.ds.lookup(dataSourceName);
					var record = datasource.getCurrentRecord();
					windowCode = record.get(dynamicValue);
					break;
				case "systemVariant":
					// 动态来源为系统变量
					windowCode = vds.component.getVariant(dynamicValue);
					break;
				case "windowVariant":
					// 动态来源为组件变量
					windowCode = vds.window.getInput(dynamicValue);
					break;
				default:
					windowCode = vds.expression.execute(dynamicValue, {
						"ruleContext": ruleContext
					});
					break;
			}
			if (!windowCode) {
				throw vds.exception.newConfigException("打开组件发生错误，当前为打开动态窗体，但窗体编号并没有指定.");
			}
			break;
		default:
			throw vds.exception.newConfigException("打开组件发生错误，无法识别打开目标窗体类型:" + openType);
	}
	return windowCode;
};

/**
 * 产生目标窗体的窗体变量信息
 */
var getOpenWindowInputParams = function (ruleContext, mappingItems) {
	var routeContext = ruleContext.getMethodContext();
	var variable = {};
	if (mappingItems) {
		for (var i = 0; i < mappingItems.length; i++) {
			var mappingItem = mappingItems[i];
			var target = mappingItem["paramName"];
			var source = mappingItem["paramValue"];
			var type = mappingItem["paramType"];
			switch (type + "") {
				case "expression":
					var expressionValue = vds.expression.execute(source, {
						"ruleContext": ruleContext
					});
					variable[target] = expressionValue;
					break;
				case "entity":
					/*
					var dataSourceName=source;
					var orignalDb=dbManager.getDB(dataSourceName); 
					if(dbManager.isDataSource(orignalDb)){
						var json = orignalDb.serialize();
						variable[target] = json
					}
					*/
					var sourceName = mappingItem["paramValue"];
					var sourceType = mappingItem["paramEntityType"];
					var fieldMappings = mappingItem["entityFieldMapping"];
					var sourceDB = null;
					if ("window" == sourceType) {
						// 来源是窗体实体的情况
						sourceDB = vds.ds.lookup(sourceName);
					} else {
						if ("ruleSetVar" == sourceType) {
							// 来源是活动集上下文变量
							sourceDB = routeContext.getVariable(sourceName);
						} else if ("ruleSetInput" == sourceType) {
							// 来源是活动集输入变量
							sourceDB = routeContext.getInput(sourceName);
						}
					}
					if (null == sourceDB) {
						throw vds.exception.newConfigException("来源变量【" + sourceName + "】不存在.");
					}

					// 创建游离DB
					//var DBFactory = sandBox.getService("vjs.framework.extension.system.datasource.factory");

					var freeDBName = "freeDB_" + vds.string.uuid();
					// var scope = scopeManager.getWindowScope();
					// var series = scope.getSeries();
					var fieldsMapping = getFreeDBFieldsMapping(fieldMappings);
					//var freeDB = DBFactory.getDBServiceWithType(series).createDBWithDS(freeDBName, fieldsMapping);
					// var freeDBInput = {
					// 	"metadata": {
					// 		"model": [{
					// 			"datasource": freeDBName,
					// 			"fields": fieldsMapping
					// 		}]
					// 	}
					// };
					var freeDB = vds.ds.unSerialize(fieldsMapping, {
						"dsCode": freeDBName
					});

					//实体间数据拷贝
					var copyFieldsMapping = getFreeDBCopyFieldsMapping(fieldMappings);
					//freeDB = dbUtil.copyEntityFromMapping(sourceDB, freeDB, copyFieldsMapping, "all");
					freeDB = vds.ds.copy(sourceDB, freeDB, copyFieldsMapping, {
						"dataFilterType": "all",
						"context": ruleContext
					});
					variable[target] = freeDB;
					break;
			}
		}
	}
	// var retValue = {
	// 	"variable": variable
	// };
	return variable;
};

var getFreeDBFieldsMapping = function (fieldMappings) {
	var fieldsMapping = [];
	for (var i = 0; i < fieldMappings.length; i++) {
		var configField = fieldMappings[i];
		var code = configField.destFieldName;
		var type = "char"; //目前没有取值的来源，只能认为都是char
		fieldsMapping.push({
			"code": code,
			"type": type
		});
	}
	return fieldsMapping;
};

var getFreeDBCopyFieldsMapping = function (fieldMappings) {
	var copyFieldsMapping = [];
	for (var i = 0; i < fieldMappings.length; i++) {
		var configField = fieldMappings[i];
		var paramEntityField = configField.destFieldName;
		var fieldValueType = (configField.srcValueType == "expression" ? "expression" : "field");
		var _srcValueItems = configField.srcValue.split(".");
		var fieldValue = _srcValueItems[_srcValueItems.length - 1];
		//2017-01-16 liangzc：映射字段来源表达式则不需要处理。
		if (fieldValueType == "expression") {
			fieldValue = configField.srcValue;
		}
		copyFieldsMapping.push({
			"destField": paramEntityField,
			"type": fieldValueType,
			"sourceValue": fieldValue
		});
	}
	return copyFieldsMapping;
};

/**
 * 获取打开窗体高度 
 */
var getOpenWindowHeight = function (inParams, ruleContext) {
	var heightExp = inParams["heightExp"];
	if (!heightExp) {
		return null;
	}
	var retValue = vds.expression.execute(heightExp, {
		"ruleContext": ruleContext
	});
	return retValue;
};

/**
 * 获取打开窗体宽度
 */
var getOpenWindowWidth = function (inParams, ruleContext) {

	var widthExp = inParams["widthExp"];
	if (!widthExp) {
		return null;
	}
	var retValue = vds.expression.execute(widthExp, {
		"ruleContext": ruleContext
	});
	return retValue;
};

/**
 * 获取打开参数
 * */
var getOpenParam = function (inParams, ruleContext) {
	var sourceValue = inParams["windowNumSource"];
	// 默认按表达式取
	openParam = vds.expression.execute(sourceValue, {
		"ruleContext": ruleContext
	});
	try {
		openParam = vds.object.stringify(openParam);
	} catch (e) {
		throw vds.exception.newConfigException("打开组件发生错误，当前为根据参数打开窗体，但参数格式不正确，当前参数：[" + openParam + "]," + e);
	}
	return openParam
}

var getMappingWindowInfo = function (componentCode, windowCode) {
	var result = {}
	result.componentCode = componentCode;
	result.windowCode = windowCode;
	if (componentCode && windowCode && window._$V3PlatformWindowMapping) {
		var mapping = window._$V3PlatformWindowMapping;
		var key = "__" + componentCode + "__" + windowCode + "__";
		if (mapping[key]) {
			return mapping[key];
		}
	}
	return result;
}

export {
	main
}