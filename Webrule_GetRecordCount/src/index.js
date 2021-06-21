/**
 * 获取数据库表中记录数
 */

	var jsonUtil;
	var WhereRestrict;
	var rendererUtil;
	var queryConditionUtil;
	var remoteMethodAccessor;
	var scopeManager;
	var rpcEnum;
	var logUtil;
	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		WhereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");
		remoteMethodAccessor = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		rendererUtil = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.error.ErrorUtil");
		queryConditionUtil = sBox.getService("vjs.framework.extension.platform.services.where.restrict.QueryCondUtil");
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		logUtil = sBox.getService("vjs.framework.extension.util.log");
	}

	var main = function(ruleContext) {
		var ruleCfg = ruleContext.getRuleCfg();
		var params = ruleCfg["inParams"];
		var ruleInstId = ruleCfg["ruleInstId"];
		var inParamsObj = jsonUtil.json2obj(params);
		var dsWhere = inParamsObj["dsWhere"]; // 获取条件
		var queryparam = inParamsObj["queryparam"];
		var routeContext = ruleContext.getRouteContext();
		var sqlStr = "";
		var wrParam = {
				"fetchMode": "custom",
				"routeContext": routeContext
			};
		var w = WhereRestrict.init(wrParam);
		var scope = scopeManager.getScope();

		if (undefined != queryparam && null != queryparam) {
			var params = queryConditionUtil.genCustomParams({
				"paramDefines": queryparam,
				"routeContext": routeContext
			});
			w.addExtraParameters(params);
		}
		if (undefined != dsWhere && null != dsWhere && dsWhere.length > 0) {
			// 有进行字段的配置，按照配置生成条件sql
			w.andExtraCondition(dsWhere, "custom");
		}
		inParamsObj["sql"] = sqlStr + w.toWhere();
		inParamsObj["parameters"] = w.toParameters();

		var resultCount = 0;

		var inputParams = {
			// ruleSetCode为活动集编号
			"ruleSetCode": "CommonRule_GetRecordCount",
			// params为活动集输入参数
			"params": {
				"InParams": jsonUtil.obj2json(inParamsObj)
			}
		};
		var callback = function(responseObj) {
			var resultCount = 0;
			var success = responseObj.IsSuccess;
			if (!success) {
				rendererUtil.handleError("获取数据库记录数失败");
				return false;
			} else {
				resultCount = responseObj.RecordCount;
			}
			if (ruleContext.setBusinessRuleResult) {
				ruleContext.setBusinessRuleResult({
					recordCount: resultCount
				});
			}
			ruleContext.fireRouteCallback();
			return true;
		};

		var errorCallback = function(responseObj) {
			logUtil.error(responseObj.message);
			ruleContext.handleException(responseObj);
		};
		//  调用后台活动集
		var sConfig = {
			"isAsyn": true,
			"componentCode": scope.getComponentCode(),
			"transactionId": routeContext.getTransactionId(),
			ruleSetCode: "CommonRule_GetRecordCount",
			commitParams: [{
				"paramName": "InParams",
				"paramType": "char",
				"paramValue": inputParams.params.InParams
			}],
			error: errorCallback,
			afterResponse: callback
		}
		var scopeId = scope.getInstanceId();
		var windowScope = scopeManager.getWindowScope();
		if (scopeManager.isWindowScope(scopeId)) {
			sConfig.windowCode = windowScope.getWindowCode();
		}
		
		remoteMethodAccessor.invoke(sConfig);
		ruleContext.markRouteExecuteUnAuto();
		return true;
	}

	exports.main = main;

export{    main}