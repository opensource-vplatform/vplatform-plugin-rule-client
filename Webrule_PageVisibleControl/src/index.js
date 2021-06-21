/**
 * 当指定字段满足某条件时控制页签显示、隐藏
 */

	var jsonUtil;
	var widgetContext;
	var widgetAction;
	var ExpressionContext;
	var engine;

	exports.initModule = function(sBox) {
		widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
	}

	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();

		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);

		var condIsSucceed = true; //inParamsObj["conditionResult"]; // TODO:判定结果
		var condFormula = inParamsObj["condition"]; //判定字符串
		var mappingItems = inParamsObj["pageCodeItem"];

		// TODO:解析公式，验证是否成立
		condIsSucceed = _parseCondFormulaSucceed(condFormula, ruleContext.getRouteContext());

		if (condIsSucceed) { // 条件成立，进行判断隐藏
			var lastShowTabId;
			for (var i = 0; i < mappingItems.length; i++) {
				var mappingItem = mappingItems[i];
				var widgetId = mappingItem["componentControlCode"];

				var hide = mappingItem["visible"];
				if (undefined != widgetId && null != widgetId) {
					if (hide.toString().toLowerCase() == "true") {
						_hideOrShowByWidgetId(widgetId, "hide"); //设置页签隐藏
					} else if (hide.toString().toLowerCase() == "false") {
						_hideOrShowByWidgetId(widgetId, "show"); //设置页签显示
						lastShowTabId = widgetId;
					}
				}
			}
			if (lastShowTabId) {
				var widgetId = widgetContext.get(lastShowTabId, "ProxyWidgetId");
				widgetAction.executeWidgetAction(widgetId, "selectedById", lastShowTabId);
			}
		}
	};

	/**
	 * 设置页签显示或隐藏
	 */
	var _hideOrShowByWidgetId = function(tabId, funcName) {
		try {
			var widgetId = widgetContext.get(tabId, "ProxyWidgetId");
			var widget = widgetContext.get(widgetId, "widgetObj")
			if (funcName == "hide") {
				widget.hideItem(tabId);

			} else if (funcName == "show") {
				widget.showItem(tabId);
			}
		} catch (re) {
			var text = widgetAction.executeWidgetAction(widgetId, "getText");
			alert(text + '控件不支持隐藏或显示操作。');
			throw re;
		}
	}

	/**
	 * 返回解析公式是否成立
	 */
	var _parseCondFormulaSucceed = function(condFormula, routeContext) {
		//解释条件
		//alert(condFormula);
		var condition = true;
		try {
			if (condFormula) {
				//condition = formulaUtil.evalExpression(condFormula);
				var context = new ExpressionContext();
				context.setRouteContext(routeContext);
				var value = engine.execute({
					"expression": condFormula,
					"context": context
				});
			}
		} catch (re) {
			alert('规则条件异常，请检查设置是否正确。');
			throw re;
		}
		return condition;
	};

	exports.main = main;

export{    main}