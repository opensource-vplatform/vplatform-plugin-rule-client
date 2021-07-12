/**
 * 打开组件并返回数据
 */

var jsonUtil;
var actionHandler;
var formulaUtil;
var UUID;
var sandBox;
var dbUtil;
var dbService;
var resourcepackage;
var browser;
var datasourceManager;
var scopeManager;
var windowParam;
var componentParam;
var widgetContext;
var ExpressionContext;
var windowVmManager;
var DBFactory;
var log;
var AppData;
var environment;
var widgetProperty;
var ExpressionContext;
var ExpressionEngine;
exports.initModule = function (sBox) {
	sandBox = sBox;
	jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
	log = sBox.getService("vjs.framework.extension.util.log");
	UUID = sBox.getService("vjs.framework.extension.util.UUID");
	ExpressionContext = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
	scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
	formulaUtil = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
	datasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
	windowParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
	componentParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.ComponentParam");
	browser = sBox.getService("vjs.framework.extension.platform.services.browser.Browser");
	DBFactory = sBox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
	exceptionFactory = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
	dbUtil = sBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePusher");
	AppData = sBox.getService("vjs.framework.extension.platform.data.storage.schema.param.ApplicationParam");
};

var main = function (ruleContext) {
	var inParams = jsonUtil.json2obj(ruleContext.getRuleCfg()["inParams"]);
	openWindow(inParams, ruleContext);
	return true;
};

var openWindow = function (inParams, ruleContext) {
	var openWindowType = inParams["openType"];
	var routeContext = ruleContext.getRouteContext();
	var businessRuleResult = {};
	var title = getOpenWindowTitle(inParams, ruleContext);
	var scope = scopeManager.getScope();
	var componentCode = scope.getComponentCode();
	var windowCode = getOpenWindowCode(inParams, ruleContext);
	var windowInputParams = getOpenWindowInputParams(routeContext, inParams["inputParams"], ruleContext);
	var height = getOpenWindowHeight(inParams, ruleContext);
	var width = getOpenWindowWidth(inParams, ruleContext);
	var openWindowParam = {};
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
		log.error("打开的窗体构件code或窗体code为空，构件code为：" + componentCode + "窗体code为：" + windowCode);
		return;
	}
	var openType = inParams["targetContainerType"];
	//start
	var renderer = sandBox.getService("vjs.framework.extension.platform.services.view.window.render.mode", {
		type: openType
	});
	if (renderer) {
		renderer.render({
			componentCode: componentCode,
			windowCode: windowCode,
			inputs: windowInputParams,
			title: title,
			ruleContext: ruleContext,
			inParams: inParams,
			businessRuleResult: businessRuleResult
		});
	} else {
		throw new Error("不正确的打开方式：" + openType);
	}
	// 设置业务返回值  	
	if (ruleContext.setBusinessRuleResult && openType != "windowContainer") {
		ruleContext.setBusinessRuleResult(businessRuleResult);
	}
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
	var context = new ExpressionContext();
	context.setRouteContext(ruleContext.getRouteContext());
	var retValue = formulaUtil.execute({
		"expression": titleExp,
		"context": context
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
			var context = new ExpressionContext();
			context.setRouteContext(ruleContext.getRouteContext());
			openParam = formulaUtil.execute({
				"expression": sourceValue,
				"context": context
			});
			try {
				openParam = jsonUtil.json2obj(openParam);
				windowCode = openParam.windowCode
			} catch (e) {
				throw new Error("打开组件发生错误，当前为根据参数打开窗体，但参数格式不正确，当前参数：[" + openParam + "]," + e, undefined, undefined, exceptionFactory.TYPES.Config);
			}
			if (!windowCode) {
				throw new Error("打开组件发生错误，当前为根据参数打开窗体，但窗体编号并没有指定", undefined, undefined, exceptionFactory.TYPES.Config);
			}
			break;
		case "appoint":
			// 指定窗体
			windowCode = inParams["windowCode"];
			if (!windowCode) {
				throw new Error("打开组件发生错误，当前为打开指定窗体，但窗体编号并没有指定", undefined, undefined, exceptionFactory.TYPES.Config);
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
						throw new Error("打开组件发生错误，当前为打开动态窗体，但来源字段格式不正确:" + dynamicValue + "。应为表名.字段名格式", undefined, undefined, exceptionFactory.TYPES.Config);
					}
					var dataSourceName = componentSrcValue.split(".")[0];
					// windowCode = viewModel.getDataModule().getSingleValueByDS(dataSourceName, dynamicValue);
					var datasource = datasourceManager.lookup({
						"datasourceName": dataSourceName
					});
					var record = datasource.getCurrentRecord();
					windowCode = record.get(dynamicValue);
					break;
				case "systemVariant":
					// 动态来源为系统变量

					windowCode = componentParam.getVariant({
						"code": dynamicValue
					});
					break;
				case "windowVariant":
					// 动态来源为组件变量

					windowCode = windowParam.getInput({
						"code": dynamicValue
					});
					break;
				default:
					// 默认按表达式取
					var context = new ExpressionContext();
					context.setRouteContext(ruleContext.getRouteContext());
					windowCode = formulaUtil.execute({
						"expression": dynamicValue,
						"context": context
					});
					break;
			}
			if (!windowCode) {
				throw new Error("打开组件发生错误，当前为打开动态窗体，但窗体编号并没有指定.", undefined, undefined, exceptionFactory.TYPES.Config);
			}
			break;
		default:
			throw new Error("打开组件发生错误，无法识别打开目标窗体类型:" + openType, undefined, undefined, exceptionFactory.TYPES.Config);
			break;
	}

	return windowCode;
};

/**
 * 产生目标窗体的窗体变量信息
 */
var getOpenWindowInputParams = function (routeContext, mappingItems, ruleContext) {
	var variable = {};
	if (mappingItems) {
		for (var i = 0; i < mappingItems.length; i++) {
			var mappingItem = mappingItems[i];
			var target = mappingItem["paramName"];
			var source = mappingItem["paramValue"];
			var type = mappingItem["paramType"];
			switch (type + "") {
				case "expression":
					var context = new ExpressionContext();
					context.setRouteContext(ruleContext.getRouteContext());
					var expressionValue = formulaUtil.execute({
						"expression": source,
						"context": context
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
					var sourceRecords = null;
					var fieldMappings = mappingItem["entityFieldMapping"];
					var sourceDB = null;
					if ("window" == sourceType) {
						// 来源是窗体实体的情况
						sourceDB = datasourceManager.lookup({
							"datasourceName": sourceName
						});
					} else {
						if ("ruleSetVar" == sourceType) {
							// 来源是活动集上下文变量
							sourceDB = routeContext.getVariable(sourceName);
						} else if ("ruleSetInput" == sourceType) {
							// 来源是活动集输入变量
							sourceDB = routeContext.getInputParam(sourceName);
						}
					}
					if (null == sourceDB) {
						throw new Error("来源变量【" + sourceName + "】不存在.", undefined, undefined, exceptionFactory.TYPES.Config);
					}

					// 创建游离DB
					//var DBFactory = sandBox.getService("vjs.framework.extension.system.datasource.factory");

					var freeDBName = "freeDB_" + UUID.generate();
					var scope = scopeManager.getWindowScope();
					var series = scope.getSeries();
					var fieldsMapping = getFreeDBFieldsMapping(fieldMappings);
					//var freeDB = DBFactory.getDBServiceWithType(series).createDBWithDS(freeDBName, fieldsMapping);
					var freeDBInput = {
						"metadata": {
							"model": [{
								"datasource": freeDBName,
								"fields": fieldsMapping
							}]
						}
					};
					var freeDB = DBFactory.unSerialize(freeDBInput);

					//实体间数据拷贝
					var copyFieldsMapping = getFreeDBCopyFieldsMapping(fieldMappings);
					//freeDB = dbUtil.copyEntityFromMapping(sourceDB, freeDB, copyFieldsMapping, "all");
					freeDB = dbUtil.copyBetweenEntities({
						"sourceEntity": sourceDB,
						"destEntity": freeDB,
						"valuesMapping": copyFieldsMapping,
						"dataFilterType": "all",
						"routeContext": routeContext
					});
					variable[target] = freeDB;
					break;
			}
		}
	}
	var retValue = {
		"variable": variable
	};
	return retValue;
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
			"paramEntityField": paramEntityField,
			"fieldValueType": fieldValueType,
			"fieldValue": fieldValue
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
	var context = new ExpressionContext();
	context.setRouteContext(ruleContext.getRouteContext());
	var retValue = formulaUtil.execute({
		"expression": heightExp,
		"context": context
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
	var context = new ExpressionContext();
	context.setRouteContext(ruleContext.getRouteContext());
	var retValue = formulaUtil.execute({
		"expression": widthExp,
		"context": context
	});
	return retValue;
};

/**
 * 获取打开参数
 * */
var getOpenParam = function (inParams, ruleContext) {
	var sourceValue = inParams["windowNumSource"];
	// 默认按表达式取
	var context = new ExpressionContext();
	context.setRouteContext(ruleContext.getRouteContext());
	openParam = formulaUtil.execute({
		"expression": sourceValue,
		"context": context
	});
	try {
		openParam = jsonUtil.json2obj(openParam);
	} catch (e) {
		throw new Error("打开组件发生错误，当前为根据参数打开窗体，但参数格式不正确，当前参数：[" + openParam + "]," + e, undefined, undefined, exceptionFactory.TYPES.Config);
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

exports.main = main;
exports.getOpenWindowInputParams = getOpenWindowInputParams;

export {
	main
}