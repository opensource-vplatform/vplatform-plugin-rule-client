/**
 *	修改数据库中的记录
 *  jiangxf 2012-3-22
 */

	var jsonUtil;
	var WhereRestrict;
	var datasourcemanager;
	var ExpressionContext;
	var context;
	var engine;
	var componentParam;
	var widgetContext;
	var widgetProperty;
	var exception;
	var windowParam;
	var accessor;
	var scopeManager;
	var logUtil;
	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		WhereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");
		datasourcemanager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
		componentParam = sBox.getService("vjs.framework.extension.platform.data.storage.runtime.param.ComponentParam");
		widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		widgetProperty = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetProperty");
		exception = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
		windowParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
		accessor = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		logUtil = sBox.getService("vjs.framework.extension.util.log");
	}

	var main = function(ruleContext) {
		var isCascadeSave = true;
		var ruleConfig = ruleContext.getRuleCfg();
		var paramsValue = ruleConfig["inParams"];
		var dataSourcesMapping = null;
		if (paramsValue) {
			var inParams = jsonUtil.json2obj(paramsValue);
			dataSourcesMapping = inParams["dataSourcesMapping"];
		}

		context = new ExpressionContext();
		var routeContext = ruleContext.getRouteContext();
		context.setRouteContext(routeContext);
		//如果存在映射关系则生成目标映射表保存数据进行保存
		if (undefined != dataSourcesMapping && null != dataSourcesMapping) {
			var parsedDatas = [];
			for (var i = 0; i < dataSourcesMapping.length; i++) {
				var dataSourceMapping = dataSourcesMapping[i];
				var currData = {};
				currData["dataSource"] = dataSourceMapping["dataSource"];
				var condition = dataSourceMapping["condition"];
				var wrParam = {
						"fetchMode": "custom",
						"routeContext": routeContext
					};
				var w = WhereRestrict.init(wrParam);
				if (undefined != condition && null != condition && condition.length > 0) {
					w.andExtraCondition(condition, "custom");
				}
				currData["condition"] = w.toWhere();
				currData["parameters"] = w.toParameters();
				currData["values"] = [];
				var dataMap = dataSourceMapping["dataMap"];
				for (var k = 0; k < dataMap.length; k++) {
					var currMap = dataMap[k];
					var colValue = currMap["colValue"];
					var valueType = currMap["valueType"];
					var value;
					var currValueObject = {};
					switch (valueType) {
						case "0": //界面实体
							var tempTabName = colValue.substring(0, colValue.indexOf("."));
							var tempColName = colValue.substring(colValue.indexOf(".") + 1, colValue.length);
							var curValue = datasourcemanager.lookup({
								"datasourceName": tempTabName
							}).getCurrentRecord();
							if (curValue) {
								value = curValue.get(tempColName);
							}
							break;
						case "expression": //表达式
							value = engine.execute({
								"expression": colValue,
								"context": context
							});
							break;
						case "2": //组件变量
							value = windowParam.getInput({
								"code": colValue
							});
							break;
						case "3": //系统变量
							value = componentParam.getVariant({
								"code": colValue
							});
							break;
						case "4": //控件
							value = widgetProperty.get(colValue, "Value");
							break;
						case "5": //固定值
							value = colValue;
							break;
						case "6": //SQL表达式
							value = engine.execute({
								"expression": colValue,
								"context": context
							});
							break;
						default:

							break;
					}
					currValueObject["destField"] = currMap["colName"];
					currValueObject["sourceField"] = value;
					currValueObject["valueType"] = valueType;
					currData["values"].push(currValueObject);
				}
				//如果所有字段值都为空则不给予保存
				if (currData["values"].length > 0) {
					parsedDatas.push(currData);
				}
			}
			if (parsedDatas.length > 0) {
				var params = {};
				params.condParams = parsedDatas;

				var callback = function(responseObj) {
					var success = responseObj.Success
					if (!success) {
						exception.create({
							"message": "修改数据库中的记录执行异常！" + result.msg,
							"type": exception.TYPES.UnExpected
						});
					}
					ruleContext.fireRouteCallback();
					return success;
				};
				var errorCallback = function(responseObj) {
					logUtil.error(responseObj.message);
					ruleContext.handleException(responseObj);
				};

				var scope = scopeManager.getScope();
				var componentCode = scope.getComponentCode();
				var routeContext = ruleContext.getRouteContext();
				var transactionId = routeContext.getTransactionId();
				var commitParams = [{
					"paramName": "InParams",
					"paramType": "char",
					"paramValue": jsonUtil.obj2json(params)
				}];
				var reObj = {
					"isAsyn": true,
					"ruleSetCode": "CommonRule_ModifyDataBaseRecord",
					"commitParams": commitParams,
					"componentCode": componentCode,
					"transactionId": transactionId,
					error: errorCallback,
					"afterResponse": callback
				}
				var scopeId = scope.getInstanceId();
				var windowScope = scopeManager.getWindowScope();
				if (scopeManager.isWindowScope(scopeId)) {
					reObj.windowCode = windowScope.getWindowCode();
				}
				accessor.invoke(reObj);
				ruleContext.markRouteExecuteUnAuto();
			}
		}
	};

	exports.main = main;

export{    main}