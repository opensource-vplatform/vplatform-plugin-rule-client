/**
 * 触发控件事件
 */

	// 加载
	var jsonUtil;
	var scopeManager;
	var eventManager;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		eventManager = sBox.getService("vjs.framework.extension.platform.services.view.event.EventManager");
	}
	// 规则主入口(必须有)
	var main = function(ruleContext) {

		// 获取规则上下文中的规则配置值
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);
		var scopeId = scopeManager.getCurrentScopeId();
		var mappingItems = inParamsObj["mappingItems"];//规则配置信息
		var funcArr = [];
		for (var i = 0; i < mappingItems.length; i++) {
			var mappingItem = mappingItems[i];
			var widgetId = mappingItem["componentControlCode"];// 需要触发事件的控件
			var componentID = mappingItem["componentID"];
			var eventName = mappingItem["actionName"];// 需要触发的事件
			if (undefined != widgetId && null != widgetId) {
				var fireWidget = function() {
					scopeManager.openScope(scopeId);
					eventManager.fireEvent(widgetId, eventName)();//触发某个控件的事件
					scopeManager.closeScope();
				}
				funcArr.push(fireWidget);
			}
		}

		var fireAllWidget = function() {
			for (var index = 0; index < funcArr.length; index++) {
				funcArr[index]();
			}
			funcArr = null;
		};

		//延迟一毫秒调用
		var t = setTimeout(fireAllWidget, 1);
		return true;
	};

	// 注册规则主入口方法(必须有)
	exports.main = main;

export{    main}