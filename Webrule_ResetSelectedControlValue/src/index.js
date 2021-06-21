/**
 * weicd 2011-11-26
 * 清空选定控件的显示数据
 * 适用场景：在某些操作前需要清空原来的数据，使其处于初始状态
 * 适用事件：所有事件
 * 功能描述： 清空指定控件的数据
 */

	var jsonUtil;
	var stringUtil;
	var widgetContext;
	var widgetAction;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
		widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
	}

	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);
		var retSetItems = inParamsObj["componentControlCodes"];
		if (!retSetItems || retSetItems.length < 1) return;
		for (var index = 0; index < retSetItems.length; index++) {
			var widgetID = retSetItems[index]["componentControlCode"];

			if (!widgetID) {
				continue;
			}

			if (!widgetContext.isWidgetExist(widgetID)) {
				throw new Error("[ResetSelectedControlValue.main]规则配置信息中控件(componentControlID)不存在,请检开发系统查组件界面中是否移除了此控件。widgetId = " + widgetID);
			}

			/**
			 * 2015-04-25 liangchaohui：
			 * 通过与zhengll沟通，遍历执行子控件函数的逻辑不应该在本规则实现
			 * 本规则只实现：调用控件的cleanSelectedControlValue接口
			 * 遍历调用子控件的cleanSelectedControlValue应当在容器控件内实现
			 */
			if (widgetAction.isWidgetActionExist(widgetID, "cleanSelectedControlValue"))
				widgetAction.executeWidgetAction(widgetID, "cleanSelectedControlValue");
			else
				throw new Error("[ResetSelectedControlValue.main]规则配置信息中控件不支持清空控件数值。widgetId = " + widgetID);

			//			var widgetType = viewContext.getWidgetTypeFromContext(widgetID);
			//			//如果是容器
			//			if(panelMap[widgetType]){
			//				//根据widgetID获得容器内所有的组件
			//				var panelItems = getPanelItems(widgetID);				
			//				for(var j = 0; j < panelItems.length; j++){					
			//					var widgetItemID=panelItems[j]
			//					var widgetItemType = viewContext.getWidgetTypeFromContext(widgetItemID);
			//					if(!panelMap[widgetItemType]){
			//						actionHandler.executeWidgetAction(widgetItemID,"cleanSelectedControlValue");
			//					}					
			//				}				
			//			}else {
			//				actionHandler.executeWidgetAction(widgetID,"cleanSelectedControlValue");
			//			}

		}
	};

	exports.main = main;

export{    main}