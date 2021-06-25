/**
 * 刷新控件候选项的值
 */
vds.import("vds.expression.*","vds.widget.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			var widgetIds = inParamsObj["ControlCodes"]; // 赋值字段的fieldName
			if (widgetIds != null && widgetIds != undefined && widgetIds.length > 0) {
				for (var i = 0; i < widgetIds.length; i++) {
					var widgetId = widgetIds[i];
					var value = vds.expression.execute("GetDropDownData(\"" + widgetId + "\", true)",{
						"context": ruleContext
					});
					vds.widget.execute(widgetId, "loadData", [value]);
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