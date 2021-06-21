/**
 * 刷新组件内系统变量的值
 */

	var jsonUtil;
	var widgetAction;
	var ExpressionContext;
	var engine;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
	}

	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams)
		var widgetIds = inParamsObj["ControlCodes"]; // 赋值字段的fieldName
		if (widgetIds != null && widgetIds != undefined && widgetIds.length > 0) {
			for (var i = 0; i < widgetIds.length; i++) {
				var widgetId = widgetIds[i];
				var context = new ExpressionContext();
				context.setRouteContext(ruleContext.getRouteContext());
				var value = engine.execute({
					"expression": "GetDropDownData(\"" + widgetId + "\", true)",
					"context": context
				});
				widgetAction.executeWidgetAction(widgetId, "loadData", value);
			}
		}
	};

	exports.main = main;

export{    main}