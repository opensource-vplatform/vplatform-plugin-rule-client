/**
 * 表间数据复制<code>
 * {
 *	"condition" : [{
 *				"columnType" : "1",
 *				"field" : "my_products_consume.productName",
 *				"fieldType" : "1",
 *				"leftBracket" : null,
 *				"logicOperation" : "",
 *				"operation" : " = ",
 *				"rightBracket" : null,
 *				"value" : "花生",
 *				"valueType" : "5"
 *			}],
 *	"destTableID" : "c9d600009fa444daa32bb500f0fabf96",
 *	"destTableName" : "my_products",
 *	"equalFields" : [{
 *				"checkRepeat" : "True",
 *				"destField" : "my_products.productName",
 *				"sourceField" : "my_products_consume.productName",
 *				"sourcetype" : "4"
 *			}, {
 *				"checkRepeat" : "False",
 *				"destField" : "my_products.totalSale",
 *				"sourceField" : "my_products_consume.amount"
 *			}],
 *	"repeatType" : "1",
 *	"sourceTableID" : "87f340420d55430bb43b510433521295",
 *	"sourceTableName" : "my_products_consume"
 * }
 * </code>
 */


	var jsonUtil;
	var WhereRestrict;
	var ParamFieldUtil;
	var dialogUtil;
	var exception;
	var operationLib;
	var scopeManager;
	var accessor;
	var whereRestrict;
	var util;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		dialogUtil = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.dialog.DialogUtil");
		WhereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");
		ParamFieldUtil = sBox.getService("vjs.framework.extension.platform.services.domain.ruleset.ParamFeldUtil");
		exception = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		accessor = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		whereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");
		util = sBox.getService("vjs.framework.extension.platform.services.where.restrict.QueryCondUtil");
	}

	function main(ruleContext) {
		var ruleConfig = ruleContext.getRuleCfg();
		var inParamObj = jsonUtil.json2obj(ruleConfig.inParams);
		var routeContext = ruleContext.getRouteContext();
		if (!check(inParamObj))
			return;

		// 处理查询条件
		var condCfgs = inParamObj.condition;
		var wrParam = {
			"fetchMode": 'custom',
			"routeContext": routeContext
		};
		var where = whereRestrict.init(wrParam);
		if (condCfgs != null && condCfgs.length > 0) {
			where.andExtraCondition(condCfgs, 'custom');
		}

		//查询参数配置
		var sourceType = inParamObj["sourceType"];
		if (sourceType == 'Query') {
			var dsQueryParam = inParamObj["queryParam"];
			if (dsQueryParam != null && dsQueryParam.length > 0) {
				dsQueryParam = util.genCustomParams({
					"paramDefines": dsQueryParam,
					"routeContext": routeContext
				});
			}
		}
		where.addExtraParameters(dsQueryParam);

		var params = {
			condSql: where.toWhere(), //查询条件
			condParams: where.toParameters() || {}, //查询参数
			equalFields: [] //字段对应关系数组
		};

		//处理字段对应关系中的参数:组件变量/系统变量/自定义值
		var fieldUtil = ParamFieldUtil.getInstance(inParamObj.equalFields,null,ruleContext.getRouteContext());
		params.equalFields = fieldUtil.toItemsConverted();
		fieldUtil.toParamMap(params.condParams);
		params.condition = inParamObj["condition"];
		params.sourceTableName = inParamObj["sourceTableName"];
		params.destTableName = inParamObj["destTableName"];
		params.repeatType = inParamObj["repeatType"];

		var callback = scopeManager.createScopeHandler({
			handler : function(responseObj) {
				var success = responseObj.Success
				if (!success) {
					exception.create({
						"message": "表间数据复制执行异常！",
						"type": exception.TYPES.UnExpected
					});
				}
				ruleContext.fireRouteCallback();
				return success;
			}
		});

		var scope = scopeManager.getWindowScope();
		if(!scope){
			scope = scopeManager.getScope();
		}
		var windowCode = scope && scope.getWindowCode ? scope.getWindowCode() : "";
		var componentCode = scope && scope.getComponentCode ? scope.getComponentCode() : "";
		var routeContext = ruleContext.getRouteContext();
		var transactionId = routeContext.getTransactionId();
		var commitParams = [{
			"paramName": "InParams",
			"paramType": "char",
			"paramValue": jsonUtil.obj2json(params)
		}];
		var reObj = {
			"isAsyn": true,
			"ruleSetCode": "CommonRule_CopyDataBetweenTables",
			"commitParams": commitParams,
			"componentCode": componentCode,
			"windowCode": windowCode,
			"transactionId": transactionId,
			"afterResponse": callback
		}
		ruleContext.markRouteExecuteUnAuto();
		accessor.invoke(reObj);
	}

	/**
	 * 配置检查
	 */
	function check(inParamObj) {
		if (!checkEqualFields(inParamObj))
			return false;
		return true;
	}

	/**
	 * 要求 非检查重复字段 必须至少有1个
	 */
	function checkEqualFields(inParamObj) {
		var equalFields = inParamObj.equalFields;
		if (equalFields == null || equalFields.length == 0) {
			// alert('[表间数据复制]规则配置有误：字段映射关系不能为空！');
			dialogUtil.infoDialog("[表间数据复制]规则配置有误：字段映射关系不能为空！", null, true);
			return false;
		}

		//行重复处理方式：忽略=1，追加=2，更新=3
		if (inParamObj.repeatType != '3') {
			return true;
		}

		var notCheckedField = false; // 非检查重复字段 必须至少有1个
		//行重复处理方式为更新时，字段更新方式：""--忽略，"1"--累加，2--覆盖，3--忽略，4--累减
		var fieldRepeattype = {
			'1': '1',
			'2': '2',
			'4': '4'
		};
		for (var i = 0; i < equalFields.length; i++) {
			var field = equalFields[i];
			if (field.checkRepeat.toLowerCase() != 'false')
				continue;
			if (fieldRepeattype[field.treatRepeattype] !== undefined) {
				notCheckedField = true;
				break;
			}
		}
		if (!notCheckedField) {
			dialogUtil.infoDialog("[表间数据复制]规则配置有误：当行重复处理方式为更新时，字段映射关系中，至少需要配置一个更新字段，并且其重复处理方式不为空或者忽略。", null, true);
			return false;
		}
		return true;
	}

	exports.main = main;

export{    main}