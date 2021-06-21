/**
 * 刷新组件内系统变量的值
 */

	var jsonUtil;
	var componentParam;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		componentParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.ComponentParam");
	}

	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);
		var systemVarNames = inParamsObj["systemVarNames"]; // 赋值字段的fieldName
		if (undefined != systemVarNames && null != systemVarNames && systemVarNames.length > 0) {
			componentParam.refreshVariant({
				"codes": systemVarNames
			});
		}
	};

	exports.main = main;

export{    main}