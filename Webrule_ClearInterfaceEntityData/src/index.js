/**
 * 清除界面实体中的数据
 */

	var jsonUtil,
	    factory,
	    datasourceManager;

	exports.initModule = function(sBox) {
		datasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		factory = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
	}

	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);
		if (null != inParamsObj) {
			var dataSourceNames = inParamsObj["dataSourceNames"];
			if (dataSourceNames) {
				for (var i = 0; i < dataSourceNames.length; i++) {
					var datasource = datasourceManager.lookup({
						"datasourceName": dataSourceNames[i]["name"]
					});
					//如果数据源存在，则执行清除
					if(datasource) {
						datasource.clear();
					}else{
						HandleException("实体["+dataSourceNames[i]["name"]+"]不存在！");
					}
				}
			}
		}
	};
	/**
	 * desc 非回调中抛异常
	 * @ruleContext 规则上下文
	 * @error_msg 提示信息
	 * vjs: 可省略
	 * services: 
	 * 		factory = sandbox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
	 * */
	function HandleException(error_msg){
		var exception = factory.create({"type":factory.TYPES.Business, "message":error_msg});
		throw exception;
	}

	exports.main = main;

export{    main}