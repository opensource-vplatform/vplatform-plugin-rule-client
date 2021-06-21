/**
 * 控件属性设置
 */

	var jsonUtil;
	var formulaUtil;
	var ExpressionContext;
	var log;
	var stringUtil;
	var rendererUtil;
	var widgetProperty;
	var widgetContext;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		formulaUtil = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
		ExpressionContext = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
		log = sBox.getService("vjs.framework.extension.util.log");
		stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
		rendererUtil = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.dialog.DialogUtil");
		widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		widgetProperty = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetProperty");
	}

	//定义常量
	var READONLY = "readonly";
	var VISIBLE = "visible";
	var VALUE = "value";
	var JAPANESETITLE = "japanesetitle";
	var COMPLEXCHINESETITLE = "complexchinesetitle";
	var ENGLISHTITLE = "englishtitle";
	var SIMPLECHINESETITLE = "simplechinesetitle";
	var ENABLED = "enabled";
	var LABELFORECOLOR = "labelforecolor";
	var LABELBACKCOLOR = "labelbackcolor";
	var VALUEFORECOLOR = "valueforecolor";
	var VALUEBACKCOLOR = "valuebackcolor";
	var MAXCHILDNUM = 'maxchildnum';
	var VALUEFORECOLOR = "valueforecolor";
	var VALUEBACKCOLOR = "valuebackcolor";


	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);
		var conditions = inParamsObj["condition"];
		if (!conditions || conditions.length < 1)
			return;
		for (var tmp = 0; tmp < conditions.length; tmp++) {
			var condition = conditions[tmp];
			var formula = condition["name"] //条件
			var isFormula = false;
			try {
				var context = new ExpressionContext();
				context.setRouteContext(ruleContext.getRouteContext());
				isFormula = formulaUtil.execute({
					"expression": formula,
					"context": context
				});
			} catch (e) {
				throw new Error("表达式" + formula + "不正确，请检查！");
//				rendererUtil.infoDialog("表达式" + formula + "不正确，请检查！", null, true);
//				return false;
			}
			var items = condition["items"];
			if (!items || items.length < 1)
				break;
			if (isFormula === true) {
				for (var index = 0; index < items.length; index++) {
					var item = items[index];

					var controlID = item["controlCode"]; //控件ID
					var propertyCode = item["propertyCode"]; // 要更改的属性ID
					var values = item["values"]; //期望值
					var valueType = item["valuetype"]; //期望值类型
					//根据属性ID得到属性名PropertyCode
					if (!stringUtil.isEmpty(values)) {
						values = getValues(values, valueType, ruleContext);
					}
					//dengb:zhengll说这段逻辑无用应该干掉
					/*if (propertyCode == ENABLED) {
						var widgetType = viewContext.getWidgetExtTypeFromContext(controlID);
						var destWidgetType = widgetType ? widgetType : viewContext.getWidgetTypeFromContext(controlID);
						if (destWidgetType == "Column") {
							rendererUtil.infoDialog("表格的列不支持设置使能属性,请检查", true);
							return false;
						}else if(destWidgetType == "TreeColumn"){
							rendererUtil.infoDialog("树表的列不支持设置使能属性,请检查", true);
							return false;
						}else if(destWidgetType == "BizCodeTreeColumn"){
							rendererUtil.infoDialog("编码树表的列不支持设置使能属性,请检查", true);
							return false;
						}
					}*/

					setProperty(controlID, propertyCode, values);
				}
			}
		}
		return true;
	};

	/**
	 *	TODO:此方法调整为统一调用插件机制的action方法，只保留默认 
	 */
	var setProperty = function(controlID, propertyCode, values) {
		//规则不创建异常对象，异常出现只管抛，由框架层捕抓并处理
		widgetProperty.set(controlID, propertyCode, values);
//		try {
//		} catch (e) {
//			var widgetType = widgetContext.getType(controlID);
//			var widgetCode = controlID;
//			var chineseTitleName = widgetProperty.get(controlID, "SimpleChineseTitle");
//			log.error("[SetControlPropertys.setProperty](" + widgetType + ")" + widgetCode + "控件属性" + propertyCode + "设置出错。");
//			var alertMsg = "控件<" + chineseTitleName + ">属性[" + propertyCode + "]赋值出错。";
//			rendererUtil.infoDialog(alertMsg, null, true);
//			return false;
//		}

	}

	/**
	 * 获得控件的属性值
	 */
	var getValues = function(controlValues, controlValueType, ruleContext) {
		if (controlValueType == "1") {
			try {
				var context = new ExpressionContext();
				context.setRouteContext(ruleContext.getRouteContext());
				var cV = formulaUtil.execute({
					"expression": controlValues,
					"context": context
				});
			} catch (e) {
				throw new Error("执行条件表达式出错，表达式为：" + controlValues);
//				rendererUtil.infoDialog("执行条件表达式出错，表达式为：" + controlValues, null, true);
//				return false;
			}
			controlValues = cV;
		}
		return controlValues;
	};

	exports.main = main;

export{    main}