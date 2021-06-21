/**
 * 树形结构复制
 */

	var jsonUtil;
	var ParamFieldUtil;
	var whereRestrict;
	var manager;
	var util;
	var remoteMethodAccessor;
	var scopeManager;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		ParamFieldUtil = sBox.getService("vjs.framework.extension.platform.services.domain.ruleset.ParamFeldUtil");
		whereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");
		manager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		util = sBox.getService("vjs.framework.extension.platform.services.where.restrict.QueryCondUtil");
		remoteMethodAccessor = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
	}

	function main(ruleContext) {
		var ruleConfig = ruleContext.getRuleCfg();
		var inParamObj = jsonUtil.json2obj(ruleConfig.inParams);
		var routeContext = ruleContext.getRouteContext();
		var componentCode = "";
		var windowCode = "";
		var scope = scopeManager.getWindowScope();
		if(!scope){
			scope = scopeManager.getScope();
			if(scope){
				componentCode = scope.getComponentCode();
			}
		}else{
			componentCode = scope.getComponentCode();
			windowCode = scope.getWindowCode();
		}
		if (!check(inParamObj)) return;

		var params = {
			condSqls: [], //查询条件
			condParams: [], //查询参数
			itemsField: [], //字段对应关系--对于系统变量、组件变量、前台表达式、实体字段参数要解析实际的值
			currId: '' //当前选中节点(要插入的目标节点Id)
		};

		for (var i = 0; i < inParamObj.items.length; i++) {
			//处理查询参数
			var condParams = {};
			var isSourceQuery = inParamObj.items[i].isSourceQuery;
			if (isSourceQuery == true || isSourceQuery == 'true') {
				var dsQueryParam = inParamObj.items[i].dsQueryParam;
				if (dsQueryParam != null && dsQueryParam.length > 0) {
					condParams = util.genCustomParams({
						"paramDefines": dsQueryParam,
						"routeContext": routeContext
					});
				}
			}

			// 处理查询条件
			var condCfgs = inParamObj.items[i].dsWhere;
			var condSqls = '';
			if (condCfgs != null && condCfgs.length > 0) {
				var wrParam = {
						"fetchMode": 'custom',
						"routeContext": routeContext
					};
				//var where = WhereRestrict.init();
				var where = whereRestrict.init(wrParam);
				where.andExtraCondition(condCfgs, 'custom');
				where.addExtraParameters(condParams);
				condSqls = where.toWhere();
				condParams = where.toParameters();
			}
			params.condSqls.push(condSqls);
			params.condParams.push(condParams);

			//处理字段对应关系
			var itemsField = inParamObj.items[i].itemsField;
			var fieldUtil = ParamFieldUtil.getInstance(itemsField,null,ruleContext.getRouteContext());
			params.itemsField.push(fieldUtil.toItemsConverted());
			fieldUtil.toParamMap(condParams);

			//对于主表来说，处理当前选中节点
			var isInsertCurrentNode = inParamObj.items[i].isInsertCurrentNode;
			if (isInsertCurrentNode === true || isInsertCurrentNode === 'true') {
				var datasource = manager.lookup({
					"datasourceName": inParamObj.items[i].destTableName
				});
				var currRow = datasource.getCurrentRecord();
				//假如没有选中的节点，则复制到根节点下
				if (currRow) {
					params.currId = currRow.getSysId();
				}
			}
		}
		params.treeStruct = inParamObj["treeStruct"];
		params.items = inParamObj["items"];

		// 调用完活动集之后的回调方法
		var callback = function(responseObj) {
			if (responseObj.Success == false) {
				throw new Error("树形结构表间数据复制执行异常:" + result.msg);
			}
		};

		var sConfig = {
			"isAsyn": false,
			"componentCode": componentCode,
			"windowCode": windowCode,
			"transactionId": routeContext.getTransactionId(),
			ruleSetCode: "CommonRule_CopyTreeDataBetweenTables",
			commitParams: [{
				"paramName": "InParams",
				"paramType": "char",
				"paramValue": jsonUtil.obj2json(params)
			}],
			error: callback
		}
		remoteMethodAccessor.invoke(sConfig);

	}

	/**
	 * 配置检查
	 */
	function check(inParamObj) {
		if (!checkMasterIdField(inParamObj)) return false;
		return true;
	}

	/**
	 * 要求 对于从表来说，必须指定目标表的外键字段(维持目标表主从关系时需要知道)
	 * 
	 * 目前的配置方式，没有指定从表目标表的外键字段，从表的外键字段是通过itemsField获取的；
	 * 这种配置方式不明显，很容易使人遗漏，所以特别检查并提示。
	 */
	function checkMasterIdField(inParamObj) {
		var items = inParamObj.items;
		for (var i = 0; i < items.length; i++) {
			// 主表或者某一个从表的规则配置
			var config = items[i];
			if (config.isMasterTable == true || config.isMasterTable == 'true') {
				//主表不需要检查
				continue;
			}

			if (!checkItemsFieldContainsSrcRefFK(config.itemsField, config.refFK)) {
				alert('[树形结构表间数据复制]规则配置有误：\n目标从表' + config.destTableName + '的外键字段必须指定。\n请在字段映射关系列表中进行配置。');
				return false;
			}
		}

		return true;
	}

	/**
	 * 检查ItemsField中，源表是否包含指定的名称
	 */
	function checkItemsFieldContainsSrcRefFK(itemsField, srcRefFK) {
		for (var i = 0; i < itemsField.length; i++) {
			if (itemsField[i].sourceField == srcRefFK) return true;
		}
		return false;
	}

	exports.main = main;

export{    main}