/**
 *	新增数据库中的记录
 *  jiangxf 2012-3-22
 */


var jsonUtil;
var errorUtil;
var dialogUtil;
var ExpressionContext;
var scopeManager;
var remoteMethodAccessor;
var rpcEnum;
var logUtil;
exports.initModule = function (sBox) {
	jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
	errorUtil = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.error.ErrorUtil");
	dialogUtil = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.dialog.DialogUtil");
	ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
	engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
	scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
	remoteMethodAccessor = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
	rpcEnum = sBox.getService("vjs.framework.extension.platform.interface.enum.RPC");
	logUtil = sBox.getService("vjs.framework.extension.util.log");


}

var main = function (ruleContext) {
	var isCascadeSave = true;
	var ruleConfig = ruleContext.getRuleCfg();
	var routeContext = ruleContext.getRouteContext();
	var paramsValue = ruleConfig["inParams"];
	var dataSourcesMapping = null;
	var scope = scopeManager.getScope();
	if (paramsValue) {
		var inParams = jsonUtil.json2obj(paramsValue);
		dataSourcesMapping = inParams["dataSourcesMapping"];
	}

	//如果存在映射关系则生成目标映射表保存数据进行保存
	if (undefined != dataSourcesMapping && null != dataSourcesMapping) {
		var parsedDatas = [];
		for (var i = 0; i < dataSourcesMapping.length; i++) {
			var dataSourceMapping = dataSourcesMapping[i];
			var dataSourceName = dataSourceMapping["dataSource"];

			var currData = {};
			currData["dataSource"] = dataSourceName;
			currData["values"] = [];
			var dataMap = dataSourceMapping["dataMap"];
			for (var k = 0; k < dataMap.length; k++) {
				var currMap = dataMap[k];
				var colValue = currMap["colValue"];
				var valueType = currMap["valueType"];
				var value;
				var currValueObject = {};
				//现在的来源类型只能为expression
				if (valueType == "expression") {
					var context = new ExpressionContext();
					context.setRouteContext(ruleContext.getRouteContext());
					var value = engine.execute({
						"expression": colValue,
						"context": context
					});
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

		//如果没有需要保存的数据则不调用后台规则
		if (parsedDatas.length > 0) {
			var params = {};
			params.condParams = parsedDatas;
			params.dataSourcesMapping = dataSourcesMapping;

			// 调用完活动集之后的回调方法
			var callback = function (responseObj) {
				logUtil.error(responseObj.message);
				ruleContext.handleException(responseObj);
			};
			var successCallBack = function (responseObj) {

				ruleContext.fireRouteCallback();
			};
			//  调用后台活动集
			var sConfig = {
				"isAsyn": true,
				"timeout": rpcEnum.TIMEOUT.SHORT,
				"componentCode": scope.getComponentCode(),
				"transactionId": routeContext.getTransactionId(),
				ruleSetCode: "CommonRule_AddDataBaseRecord",
				commitParams: [{
					"paramName": "InParams",
					"paramType": "char",
					"paramValue": jsonUtil.obj2json(params)
				}],
				error: callback,
				afterResponse: successCallBack
			}

			var scopeId = scope.getInstanceId();
			var windowScope = scopeManager.getWindowScope();
			if (scopeManager.isWindowScope(scopeId)) {
				sConfig.windowCode = windowScope.getWindowCode();
			}
			remoteMethodAccessor.invoke(sConfig);
			ruleContext.markRouteExecuteUnAuto();
		}
	}

};

exports.main = main;

export {
	main
}