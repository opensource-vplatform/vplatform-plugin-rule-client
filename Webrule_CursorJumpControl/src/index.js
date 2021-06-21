/**
 * 光标跳转控制
 * 当条件满足时跳转光标到指定的控件
 */

	var jsonUtil;
	var widgetModule;
	var widgetAction;

	exports.initModule = function(sb) {
		widgetModule = sb.getService("vjs.framework.extension.widget.manager.widgetModule");
		jsonUtil = sb.getService("vjs.framework.extension.util.JsonUtil");
		widgetAction = sb.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
	}

	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamObj = jsonUtil.json2obj(inParams);
		var widgetId = inParamObj["ControlCode"];

		if (!widgetId) {
			throw new Error("[CursorJumpControl.main]光标跳转规则中配置参数控件ID不能为空！ 。");
		}

		widgetAction.executeWidgetAction(widgetId, "setFocus", widgetId);
	}

	exports.main = main;

export{    main}