/**
 *  给界面实体/控件/变量赋值
 */

	var sandBox;
	var baseVarOperation;

	exports.initModule = function (sBox) {
		sandBox = sBox;
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		baseVarOperation = sBox.getService("vjs.framework.extension.platform.services.window.variable.operation.BaseVarOperation");
	}

	var main = function (ruleContext) {
		var inParams = jsonUtil.json2obj(ruleContext.getRuleCfg()["inParams"]);
		var fieldMap = inParams["FieldMap"];
		if (!fieldMap || fieldMap.length <= 0) {
			log.warn("没有配置任何字段映射信息，无法进行赋值");
			return;
		}
		baseVarOperation.setVariableValue(fieldMap, ruleContext.getRouteContext());
	};
	
	exports.main = main;

export{    main}