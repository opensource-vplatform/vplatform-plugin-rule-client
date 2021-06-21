/**
 * 记录引用检查 <code>
 * {
 *	"sourceTable" : "Company", //
 *	"sourceField" : "Company.ID", // 检查值来源(当前组件实体/数据集)
 *	"checkTable" : "Contract",
 *  "Condition" : "Condition",//过滤条件
 *	"checkField" : "Contract.CompanyID" // 检查表(数据库表)
 * }
 * </code>
 * 
 * @return true 记录没有被引用
 * @return false 记录被其他表引用
 */

	var jsonUtil;
	var WhereRestrict;
	var remoteMethodAccessor;
	var datasourcePuller;
	var scopeManager;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		datasourcePuller = sBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePuller");
		remoteMethodAccessor = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		WhereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
	}

	// 业务返回值：是否被引用,true表示有引用
	var BIZ_RESULT_ISREFERENCED = 'isReferenced';

	function main(ruleContext) {debugger;
		var ruleConfig = ruleContext.getRuleCfg();
		var inParamObj = jsonUtil.json2obj(ruleConfig.inParams);
		var scope = scopeManager.getWindowScope();
		var rows = datasourcePuller.getSelectedAndCurrentRecords({
			"datasourceName": inParamObj.sourceTable
		});
		//如果要检查的数据源当前没有选中行，则检查通过，业务返回值为false[表示没有被引用]
		if (!rows || rows.length == 0) {
			setBusinessRuleResult(ruleContext, false);
			return true;
		}
		var routeRuntime = ruleContext.getRouteContext();

		var params = {
			rowValues: [],
			condition: "",
			parameters: {}
		};
		// 构建查询条件
		var wrParam = {
				"fetchMode": "custom",
				"routeContext": routeRuntime
			};
		var w = WhereRestrict.init(wrParam);
		var orConds = [];
		var sourceField = inParamObj.sourceField.split(".")[1];
		for (var i = 0; i < rows.length; i++) {
			var value = rows[i].get(sourceField);
			// 跳过空值不检查
			if (value != null) {
				params.rowValues.push(value);
				orConds.push(w.eq(inParamObj.checkField, value));
			}
		}
		w.or(orConds);

		var condition = inParamObj.Condition;
		if (undefined != condition && null != condition && condition.length > 0) {
			w.andExtraCondition(condition, "custom");
		}
		params.condition = w.toWhere();
		params.parameters = w.toParameters();
		params.checkTable = inParamObj["checkTable"];

		
		// 2015-05-22 liangchaohui：如果检查字段的值是Null，会执行该记录，如果没有需要检查的记录，则直接返回false
		if (params.rowValues.length < 1) {
			setBusinessRuleResult(ruleContext, false);
		} else {
			var callback =  scopeManager.createScopeHandler({
				handler : function(responseObj) {
					var result = responseObj.Success;
					setBusinessRuleResult(ruleContext, result);
					ruleContext.fireRouteCallback();
					return true;
				}
			});
			var errorCallback = scopeManager.createScopeHandler({
				handler : function(responseObj) {
					var result = responseObj.Success;
					throw new Error("记录引用检查执行异常！" + result);
				}
			});
			var sConfig = {
				"isAsyn": true,
				"componentCode": scope.getComponentCode(),
				"windowCode": scope.getWindowCode(),
				"transactionId": ruleContext.getRouteContext().getTransactionId(),
				ruleSetCode: "CommonRule_RecordReferenceCheck",
				commitParams: [{
					"paramName": "InParams",
					"paramType": "char",
					"paramValue": jsonUtil.obj2json(params)
				}],
				afterResponse: callback,
				error: errorCallback
			}
			ruleContext.markRouteExecuteUnAuto();
			remoteMethodAccessor.invoke(sConfig);
		}
	}

	function setBusinessRuleResult(ruleContext, result) {
		if (ruleContext.setBusinessRuleResult) {
			ruleContext.setBusinessRuleResult({
				isReferenced: result
			});
		}
	}

	exports.main = main;

export{    main}