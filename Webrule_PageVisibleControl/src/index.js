/**
 * 当指定字段满足某条件时控制页签显示、隐藏
 */
vds.import("vds.widget.*","vds.expression.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			var condIsSucceed = true; //inParamsObj["conditionResult"]; // TODO:判定结果
			var condFormula = inParamsObj["condition"]; //判定字符串
			var mappingItems = inParamsObj["pageCodeItem"];
			if(condFormula){
				condIsSucceed = vds.expression.execute(condFormula, {
					"ruleContext": ruleContext
				});
			}
			if (condIsSucceed) { // 条件成立，进行判断隐藏
				var lastShowTabId;
				for (var i = 0; i < mappingItems.length; i++) {
					var mappingItem = mappingItems[i];
					var widgetId = mappingItem["componentControlCode"];

					var hide = mappingItem["visible"];
					if (undefined != widgetId && null != widgetId) {
						var proxyWidgetId = vds.widget.getProperty(widgetId, "ProxyWidgetId");
						if (hide.toString().toLowerCase() == "true") {
							vds.widget.execute(proxyWidgetId, "hideItem",[widgetId]);
						} else if (hide.toString().toLowerCase() == "false") {
							vds.widget.execute(proxyWidgetId, "showItem",[widgetId]);
							lastShowTabId = widgetId;
						}
					}
				}
				if (lastShowTabId) {
					var widgetId = vds.widget.getProperty(lastShowTabId, "ProxyWidgetId");
					vds.widget.execute(widgetId, "selectedById", [lastShowTabId]);
				}
			}
			resolve();
		} catch (err) {
			reject(err);
		}
	});
}
export {
	main
}