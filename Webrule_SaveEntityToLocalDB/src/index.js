/**
 *  保存实体数据到手机本地数据库
 *  wangyue 2019-12-27
 */

	var jsonUtil;
	var sandbox,manager,DBFactory,ExpressionContext,engine;

	exports.initModule = function(sBox) {
		sandbox = sBox;
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		manager = sandbox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		DBFactory = sandbox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
		ExpressionContext = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		engine = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
	}

	var main = function(ruleContext) {
		var isSuccess = true; // 用于记录保存是否成功
		var ruleCfg = ruleContext.getRuleCfg();
		var paramsValue = ruleCfg["inParams"];
		var treeStructMapArray, paramsJson;
		if (paramsValue) {
			paramsJson = jsonUtil.json2obj(paramsValue);
			treeStructMapArray = paramsJson["treeStruct"];
		}
		var dataSourceMappings = paramsJson ? paramsJson["dataSourceMap"] : null;
		var configs = [];
		if (undefined != dataSourceMappings && null != dataSourceMappings) {
			for (var i = 0; i < dataSourceMappings.length; i++) {
				var dataSourceMapping = dataSourceMappings[i];
				//是否保存所有，否则只保存改变的数据，为布尔值，如果是旧规则值为undefined
				var isSaveAll = dataSourceMapping["isSaveAll"];
				//兼容旧规则处理，默认为true
				if (isSaveAll == null || isSaveAll == undefined) {
					isSaveAll = true;
				}
				//源数据源（可能为内存表、查询或物理表）
				var dataSourceName = dataSourceMapping["dataSource"];
				var dataSourceNameType = dataSourceMapping["dataSourceType"];//获取实体类型
				if (validateDatasourceName(dataSourceName)) {
					/*给实体添加前缀*/
					dataSourceName = addPrefixToDBName(dataSourceName,dataSourceNameType);
					var config = {
						"modelSchema": {
							"modelMapping": {
								"sourceModelName": dataSourceName,
								"targetModelName": dataSourceMapping["destTab"],
								"fieldMappings": dataSourceMapping["dataMap"],
								"isFieldAutoMapping": dataSourceMapping.isFieldAutoMapping === true ? true : false
							}
						},
						"saveAll": isSaveAll
					};
					configs.push(config);
				}
			}
		}
		if (configs.length > 0) {
			var params = {
				"routeContext": ruleContext.getRouteContext(),
				"configs": configs,
				"treeStructs": treeStructMapArray,
				"isAsync":true,
				"isLocalDb":true,
				"success":function(result){
					ruleContext.setRuleStatus(true);
					ruleContext.fireRuleCallback();
					ruleContext.fireRouteCallback();
				 },
				"error": function(result) {
					var str = "保存映射关系失败!";
					alert(str + result.msg);
					isSuccess = false;
				}
			};
			var dataAdapter = sandbox.getService("vjs.framework.extension.platform.services.viewmodel.dataadapter.DataAdapter");
			dataAdapter.saveData(params);
			//终止规则链执行
			ruleContext.markRouteExecuteUnAuto();
		}
		return isSuccess;
	};
	/**
	 * desc 给实体添加前缀
	 * entityName 实体名称
	 * entityType 实体类型
	 * */
	function addPrefixToDBName(entityName,entityType){
		var dbName = entityName;
		/*无实体类型，默认为界面实体，不用加前缀*/
		if(undefined == entityType || entityType == ""){
			return dbName;
		}
		var type = "";
		if(entityType=="ruleSetOutput"){//方法输出
			type="BR_OUT_PARENT.";
		}else if(entityType=="ruleSetInput"){//方法输入
			type="BR_IN_PARENT.";
		}else if(entityType=="ruleSetVar"){//方法变量
			type="BR_VAR_PARENT.";
		}
		dbName = type + dbName;
		return dbName;
	}
	/**
	 * 检查数据源名称
	 * @return {Boolean} 
	 */
	var validateDatasourceName = function(dsName) {
		var flag = true;
		if (undefined == dsName || null == dsName || "" == dsName) {
			flag = false;
		}
		return flag;
	}
	/**
	 * desc 获取各类数据源（窗体实体、方法实体）
	 * dataSourceName 数据源名称
	 * routeContext 路由上下文
	 * vjs: 
	 * 		"vjs.framework.extension.platform.interface.exception":null,
	 * 		"vjs.framework.extension.platform.services.model.manager.datasource":null
	 * services: 
	 * 		manager = sandbox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
	 * 		DBFactory = sandbox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
	 * 		ExpressionContext = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
	 * 		engine = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
	 * */
	function getDataSource(dataSourceName,routeContext){
		var dsName = dataSourceName;
		var datasource = null;
		if(dsName!=null && dsName != ""){
			/*本身是实体对象*/
			if(DBFactory.isDatasource(dsName)){
				datasource = dsName;
			}else{
				var context = new ExpressionContext();
				context.setRouteContext(routeContext);
				/*前台实体*/
				if(dsName.indexOf(".")==-1&&dsName.indexOf("@")==-1){
					datasource = manager.lookup({
						"datasourceName": dsName
					});
				}else{
					/*方法实体*/
					datasource = engine.execute({
						"expression": dsName,
						"context": context
					});
				}
			}
		}
		return datasource;
	}
	exports.main = main;

export{    main}